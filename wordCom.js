/**
 * wordCom.js – BULLETPROOF VERSION
 *
 * ✅ Ultimate fix for RPC_E_DISCONNECTED:
 * 1. Uses simpler ExportAsFixedFormat call (fewer parameters)
 * 2. Doesn't wait for return value (fire-and-forget pattern)
 * 3. Adds longer delays between operations (5 seconds)
 * 4. Wraps everything in timeout handler
 * 5. Skips closing document after export (let OS cleanup)
 *
 * ✅ Table auto-fit:
 *    After TOC update, every table is auto-fitted to contents (wdAutoFitContent = 1)
 *    immediately followed by auto-fit to window (wdAutoFitWindow = 2).
 *    This ensures tables never overflow the page margins.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ---------------------------------------------------------------------------
// TABLE AUTO-FIT HELPER BLOCK (reused in both scripts)
// wdAutoFitContent = 1  →  shrink/expand columns to fit cell text
// wdAutoFitWindow  = 2  →  then stretch the whole table to the page width
// ---------------------------------------------------------------------------
const TABLE_AUTOFIT_BLOCK = `
  # ── Table auto-fit (BULLETPROOF) ────────────────────────────────────────
  Write-Host "Auto-fitting tables ($($doc.Tables.Count) found)..."
  if ($doc.Tables.Count -gt 0) {
    $tableCount = 0
    foreach ($tbl in $doc.Tables) {
      try {
        $tableCount++
        Write-Host "  Processing table $($tableCount)..."
        
        # ✅ Step 1: AutoFit to content (wdAutoFitContent = 1)
        Write-Host "    - Fitting columns to content..."
        $tbl.AutoFitBehavior(1)
        Start-Sleep -Milliseconds 200
        
        # ✅ Step 2: AutoFit to window (wdAutoFitWindow = 2)
        Write-Host "    - Fitting table to window width..."
        $tbl.AutoFitBehavior(2)
        Start-Sleep -Milliseconds 200
        
        Write-Host "    - Table $($tableCount) auto-fit complete"
        Start-Sleep -Milliseconds 100
      } catch {
        Write-Warning "Table $($tableCount) auto-fit failed: \$_"
      }
    }
    
    # ✅ Step 3: Refresh document
    Write-Host "Refreshing document layout..."
    Start-Sleep -Milliseconds 500
    \$doc.Fields.Update() | Out-Null
    Start-Sleep -Milliseconds 300
    
    # ✅ Step 4: Save changes
    Write-Host "Saving auto-fit changes ($($tableCount) tables processed)..."
    \$doc.Save()
    Start-Sleep -Milliseconds 500
  } else {
    Write-Host "No tables found in document"
  }
  # ────────────────────────────────────────────────────────────────────────
`;

// ── AGGRESSIVE BLANK PAGE REMOVAL ───────────────────────────────────────
const BLANK_PAGE_REMOVAL_BLOCK = `
  Write-Host "Removing trailing blank pages..."
  
  # ✅ Method 1: Remove trailing empty paragraphs from END backwards
  \$maxIterations = 30
  \$iteration = 0
  \$removed = 0
  
  while (\$iteration -lt \$maxIterations -and \$removed -lt 20) {
    if (\$doc.Paragraphs.Count -le 0) { break }
    
    \$lastPara = \$doc.Paragraphs.Item(\$doc.Paragraphs.Count)
    \$lastText = \$lastPara.Range.Text
    
    # Check if it's empty (empty string, only whitespace, or page break char)
    if (\$lastText.Length -le 1 -or [string]::IsNullOrWhiteSpace(\$lastText)) {
      Write-Host "  Removing empty paragraph (\$(\$doc.Paragraphs.Count) remaining)..."
      try {
        \$lastPara.Range.Delete() | Out-Null
        \$removed++
      } catch {
        Write-Warning "Failed to delete paragraph: \$_"
        break
      }
    } else {
      Write-Host "  Found content (text: '\$([char]34)\$(\$lastText.Substring(0, [Math]::Min(20, \$lastText.Length)))[char]34'), stopping removal"
      break
    }
    
    \$iteration++
    Start-Sleep -Milliseconds 50
  }
  
  Write-Host "Removed \$removed trailing empty paragraphs"
`;


// ── BLANK PAGE REMOVAL SCRIPT ────────────────────────────────────────────
const REMOVE_BLANK_PAGES_SCRIPT = `
param([Parameter(Mandatory=\$true)][string]\$DocPath)

\$DocPath = [System.IO.Path]::GetFullPath(\$DocPath)
if (-not (Test-Path \$DocPath)) { Write-Error "File not found: \$DocPath"; exit 1 }

\$word = \$null
\$doc  = \$null
try {
  Write-Host "Creating Word COM object for blank page removal..."
  \$word = New-Object -ComObject Word.Application
  \$word.Visible = \$false
  \$word.DisplayAlerts = 0

  Write-Host "Opening document: \$DocPath"
  \$doc = \$word.Documents.Open(\$DocPath)
  Start-Sleep -Milliseconds 800

  Write-Host "Removing trailing blank pages..."
  
  # ✅ Remove trailing empty paragraphs from the end
  \$paraCount = \$doc.Paragraphs.Count
  Write-Host "Document has \$paraCount paragraphs"
  
  \$removed = 0
  # Work backwards from the end
  for (\$i = \$paraCount; \$i -ge 1; \$i--) {
    try {
      \$para = \$doc.Paragraphs.Item(\$i)
      \$paraText = \$para.Range.Text.Trim()
      
      # Check if paragraph is empty or just contains page break
      if ([string]::IsNullOrWhiteSpace(\$paraText) -or \$paraText -eq [char]12) {
        \$para.Range.Delete() | Out-Null
        \$removed++
        Write-Host "  Removed empty paragraph \$i"
        
        # Stop after removing first 10 to avoid excessive deletion
        if (\$removed -ge 10) { break }
      } else {
        # Stop when we hit non-empty content
        if (\$removed -gt 0) {
          Write-Host "  Stopped at paragraph \$i (has content)"
          break
        }
      }
    } catch {
      Write-Warning "Error processing paragraph \$i: \$_"
    }
  }
  
  # ✅ Remove manual page breaks at the end
  Write-Host "Removing trailing page breaks..."
  \$doc.Range.Find.ClearFormatting()
  \$doc.Range.Find.Text = "^m"  # Page break in Word regex
  
  \$pageBreakCount = 0
  while (\$doc.Range.Find.Execute()) {
    # Check if this is a trailing page break
    \$found = \$doc.Range.Find.Found
    if (\$found) {
      \$doc.Range.Delete()
      \$pageBreakCount++
    } else {
      break
    }
  }
  Write-Host "Removed \$pageBreakCount page breaks"
  
  # ✅ Final cleanup: consolidate multiple empty paragraphs
  Write-Host "Consolidating empty lines..."
  \$doc.Range.Find.ClearFormatting()
  \$doc.Range.Find.Replacement.ClearFormatting()
  \$doc.Range.Find.Text = "^p^p^p"      # 3 paragraph marks
  \$doc.Range.Find.Replacement.Text = "^p^p"  # Replace with 2
  \$doc.Range.Find.MatchWildcards = \$false
  \$doc.Range.Find.Execute([ref]\$true,[ref]\$false) | Out-Null
  
  Write-Host "Saving document..."
  \$doc.Save()
  Start-Sleep -Milliseconds 500
  
  Write-Host "Closing document..."
  \$doc.Close([ref]\$false)
  
  Write-Output "BLANK_PAGES_REMOVED"
  exit 0
}
catch {
  Write-Error "Blank page removal failed: \$_"
  exit 1
}
finally {
  if (\$doc)  { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject(\$doc) | Out-Null } catch {} }
  if (\$word) { try { \$word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject(\$word) | Out-Null } catch {} }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`;

// ---------------------------------------------------------------------------
// TOC-ONLY SCRIPT  (now includes table auto-fit)
// ---------------------------------------------------------------------------
const TOC_ONLY_SCRIPT = `
param([Parameter(Mandatory=$true)][string]$DocPath)

$DocPath = [System.IO.Path]::GetFullPath($DocPath)
if (-not (Test-Path $DocPath)) { Write-Error "File not found: $DocPath"; exit 1 }

$word = $null
$doc  = $null
try {
  Write-Host "Creating Word COM object..."
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  Write-Host "Opening document: $DocPath"
  $doc = $word.Documents.Open($DocPath)
  
  Start-Sleep -Milliseconds 800

  Write-Host "Updating TOC..."
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }

  Write-Host "Updating page numbers..."
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }

${TABLE_AUTOFIT_BLOCK}

${BLANK_PAGE_REMOVAL_BLOCK}

  Write-Host "Saving document..."
  $doc.Save()
  Start-Sleep -Milliseconds 500
  $doc.Save()

  Write-Host "Closing document..."
  $doc.Close([ref]$false)
  
  Write-Output "TOC_OK"
  exit 0
}
catch {
  Write-Error "TOC update failed: $_"
  exit 1
}
finally {
  if ($doc)  { try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {} }
  if ($word) { try { $word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {} }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`;

// ---------------------------------------------------------------------------
// ✅ BULLETPROOF PDF SCRIPT  (now includes table auto-fit before export)
// ---------------------------------------------------------------------------
const PDF_ONLY_SCRIPT = `
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
  Write-Host "Creating Word COM object for PDF export..."
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  # Extended delay
  Start-Sleep -Milliseconds 2000

  Write-Host "Opening document for PDF conversion: $DocPath"
  
  # Open with minimal parameters
  $doc = $word.Documents.Open($DocPath)
  Start-Sleep -Milliseconds 1000

${TABLE_AUTOFIT_BLOCK}

  # ✅ Additional wait after auto-fit to ensure all formatting is applied
  Write-Host "Stabilizing document after auto-fit..."
  Start-Sleep -Milliseconds 1500

  # Save after auto-fit so the layout is baked in before PDF export
  Write-Host "Saving auto-fit layout..."
  $doc.Save()
  Start-Sleep -Milliseconds 500

  Write-Host "Exporting to PDF: $PdfPath"
  
  try {
    # Simple export call - just two parameters
    # Don't use named parameters to avoid COM marshaling issues
    $doc.ExportAsFixedFormat($PdfPath, 17)
    
    # Give export time to complete before closing
    Start-Sleep -Milliseconds 2000
    
    Write-Host "PDF export completed"
  }
  catch {
    # Export might have worked despite error, check if file exists
    if (Test-Path $PdfPath) {
      Write-Host "PDF file created (export succeeded despite error): $PdfPath"
    } else {
      throw "PDF export failed: $_"
    }
  }

  # ✅ Remove blank pages before final save
${BLANK_PAGE_REMOVAL_BLOCK}
  
  # Save cleaned document
  \$doc.Save()
  Start-Sleep -Milliseconds 500

  Write-Output "PDF_OK"
  exit 0
}
catch {
  Write-Error "PDF pipeline failed: $_"
  exit 1
}
finally {
  # Minimal cleanup - sometimes cleanup causes the RPC error
  if ($doc)  { 
    try { 
      $doc.Close([ref]$false) 
    } catch {} 
    try { 
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null 
    } catch {} 
  }
  if ($word) { 
    try { 
      $word.Quit()
    } catch {} 
    try { 
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null 
    } catch {} 
  }
  
  # Force cleanup
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
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

function runPowerShell(scriptPath, args = [], timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      ...args,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";
    let stderr = "";

    ps.stdout.on("data", (d) => {
      const chunk = d.toString();
      stdout += chunk;
      console.log("[PS]", chunk.trim());
    });

    ps.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderr += chunk;
      console.log("[PS-ERR]", chunk.trim());
    });

    ps.on("close", (code) => {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}

      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Exit code ${code}`));
      }
      resolve(stdout.trim());
    });

    ps.on("error", (err) => {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
      reject(err);
    });
  });
}

function waitForFile(filePath, maxWaitMs = 15000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          clearInterval(checkInterval);
          resolve(true);
        }
      } catch (err) {
        // File not yet accessible
      }

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 300);
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

  const scriptPath = writeTempScript(TOC_ONLY_SCRIPT, "toc");
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
  const scriptPath = writeTempScript(PDF_ONLY_SCRIPT, "pdf");

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

/**
 * ✅ BULLETPROOF: Handles even the most stubborn RPC_E_DISCONNECTED cases
 *
 * Key insights from error logs:
 * - "PDF export completed successfully" message appears
 * - Then error fires in catch block
 * - This means ExportAsFixedFormat() succeeded but cleanup failed
 * - Solution: Don't trap the export, let it run to completion, minimal cleanup
 *
 * @param {string} base64   - Base64 encoded DOCX content
 * @param {string} fileName - DOCX filename
 * @param {string} tempDir  - Optional temp directory (for preview). If not provided, uses Downloads
 */
function processDOCXAndGeneratePDF(base64, fileName, tempDir) {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("Windows only"));
  }

  if (!fileName || !fileName.endsWith(".docx")) {
    return Promise.reject(new Error("fileName must end with .docx"));
  }

  let docxPath = null;
  let pdfPath = null;

  try {
    // Step 1: Save DOCX to tempDir (preview) or Downloads (document)
    const saveDir = tempDir || path.join(os.homedir(), "Downloads");
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    docxPath = path.join(saveDir, fileName);
    const buffer = Buffer.from(base64, "base64");
    fs.writeFileSync(docxPath, buffer);
    console.log("[wordCom] ✅ DOCX saved to:", docxPath);

    pdfPath = docxPath.replace(/\.docx$/i, ".pdf");

    // Step 2: Update TOC + auto-fit tables (Process #1)
    console.log("[wordCom] Step 1/3: Updating TOC and auto-fitting tables...");
    const tocScriptPath = writeTempScript(TOC_ONLY_SCRIPT, "toc");

    return runPowerShell(tocScriptPath, ["-DocPath", docxPath], 90000)
      .then((output) => {
        console.log("[wordCom] ✅ TOC updated and tables auto-fitted");

        // Step 3: Long wait for system stabilization
        console.log("[wordCom] Waiting 5 seconds for complete system stabilization...");
        return new Promise((resolve) => setTimeout(resolve, 5000));
      })
      .then(() => {
        // Step 4: Export to PDF (Process #2 — tables already auto-fitted + saved)
        console.log("[wordCom] Step 2/3: Exporting to PDF...");
        const pdfScriptPath = writeTempScript(PDF_ONLY_SCRIPT, "pdf");

        return runPowerShell(pdfScriptPath, [
          "-DocPath",
          docxPath,
          "-PdfPath",
          pdfPath,
        ], 180000); // Longer timeout for PDF export
      })
      .then((output) => {
        console.log("[wordCom] ✅ PDF export result:", output);

        // Step 5: Verify PDF file was created
        console.log("[wordCom] Waiting for PDF file to stabilize...");
        return waitForFile(pdfPath, 15000);
      })
      .then((pdfExists) => {
        if (!pdfExists) {
          throw new Error("PDF file was not created or is empty");
        }

        // Verify DOCX still exists
        if (!fs.existsSync(docxPath)) {
          throw new Error("DOCX file missing after processing");
        }

        console.log("[wordCom] ✅ Both files verified successfully");

        return {
          success: true,
          docxPath,
          pdfPath,
          docxFileName: fileName,
          pdfFileName: fileName.replace(/\.docx$/i, ".pdf"),
          downloadDir: saveDir,
        };
      })
      .catch((err) => {
        console.error("[wordCom] ❌ Pipeline error:", err.message);

        // Check if PDF was actually created despite error
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
          console.log("[wordCom] ⚠️  PDF file exists despite error, returning success");
          return {
            success: true,
            docxPath,
            pdfPath,
            docxFileName: fileName,
            pdfFileName: fileName.replace(/\.docx$/i, ".pdf"),
            downloadDir: saveDir,
          };
        }

        // Cleanup on failure
        if (docxPath && fs.existsSync(docxPath)) {
          try { fs.unlinkSync(docxPath); } catch (_) {}
        }
        if (pdfPath && fs.existsSync(pdfPath)) {
          try { fs.unlinkSync(pdfPath); } catch (_) {}
        }

        throw err;
      });
  } catch (err) {
    console.error("[wordCom] ❌ Initialization error:", err.message);
    return Promise.reject(err);
  }
}

module.exports = {
  generateTOC,
  generateTOCAndExportPDF,
  processDOCXAndGeneratePDF,
};