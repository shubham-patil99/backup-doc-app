/**
 * wordCom.js – FIXED VERSION (no quoting issues)
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ---------------------------------------------------------------------------
// TOC SCRIPT
// ---------------------------------------------------------------------------
const TOC_SCRIPT = `
param([Parameter(Mandatory=$true)][string]$DocPath)

$DocPath = [System.IO.Path]::GetFullPath($DocPath)
if (-not (Test-Path $DocPath)) { Write-Error "File not found: $DocPath"; exit 1 }

$word = $null
$doc  = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($DocPath)

  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }

  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }

  $doc.Save()
  $doc.Close([ref]$false)

  Write-Output "TOC_OK: $DocPath"
  exit 0
}
catch {
  Write-Error "TOC update failed: $_"
  exit 1
}
finally {
  if ($doc)  { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
  if ($word) { try { $word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {} }
}
`;

// ---------------------------------------------------------------------------
// PDF SCRIPT
// ---------------------------------------------------------------------------
const PDF_SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$DocPath,
  [Parameter(Mandatory=$true)][string]$PdfPath
)

$DocPath = [System.IO.Path]::GetFullPath($DocPath)
$PdfPath = [System.IO.Path]::GetFullPath($PdfPath)
if (-not (Test-Path $DocPath)) { Write-Error "File not found: $DocPath"; exit 1 }

$word = $null
$doc  = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($DocPath)

  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }

  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }

  $doc.Save()

  $doc.ExportAsFixedFormat($PdfPath, 17)
  $doc.Close([ref]$false)

  Write-Output "PDF_OK: $PdfPath"
  exit 0
}
catch {
  Write-Error "PDF export failed: $_"
  exit 1
}
finally {
  if ($doc)  { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
  if ($word) { try { $word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {} }
}
`;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function writeTempScript(content, suffix) {
  const filePath = path.join(os.tmpdir(), `brahma_${suffix}_${Date.now()}.ps1`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function runPowerShell(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...args,
    ]);

    let stdout = "";
    let stderr = "";

    ps.stdout.on("data", (d) => (stdout += d.toString()));
    ps.stderr.on("data", (d) => (stderr += d.toString()));

    ps.on("close", (code) => {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}

      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Exit code ${code}`));
      }
      resolve(stdout.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

function generateTOC(docPath) {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("Windows only"));
  }

  const absPath = path.resolve(docPath);
  if (!fs.existsSync(absPath)) {
    return Promise.reject(new Error("File not found"));
  }

  const scriptPath = writeTempScript(TOC_SCRIPT, "toc");

  console.log("[wordCom] generateTOC:", absPath);

  return runPowerShell(scriptPath, ["-DocPath", absPath]);
}

function generateTOCAndExportPDF(docPath) {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("Windows only"));
  }

  const absDoc = path.resolve(docPath);
  if (!fs.existsSync(absDoc)) {
    return Promise.reject(new Error("File not found"));
  }

  const absPdf = absDoc.replace(/\.docx$/i, ".pdf");
  const scriptPath = writeTempScript(PDF_SCRIPT, "pdf");

  console.log("[wordCom] generateTOCAndExportPDF:", absDoc);

  return runPowerShell(scriptPath, [
    "-DocPath",
    absDoc,
    "-PdfPath",
    absPdf,
  ]).then(() => ({
    docxPath: absDoc,
    pdfPath: absPdf,
  }));
}

module.exports = {
  generateTOC,
  generateTOCAndExportPDF,
};
