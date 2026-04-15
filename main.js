/**
 * main.js  – Electron main process
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const http = require("http");
const { exec } = require("child_process");
const { generateTOC, generateTOCAndExportPDF, processDOCXAndGeneratePDF } = require("./wordCom");

// ── Built-in MIME types ─────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".txt":  "text/plain; charset=utf-8",
  ".map":  "application/json",
};

function getMime(filepath) {
  return MIME[path.extname(filepath).toLowerCase()] || "application/octet-stream";
}

// ── Inline static file server ───────────────────────────────────────────────
// Returns a promise that resolves with the chosen port once the server is listening.
let staticServer = null;

function startStaticServer(dir) {
  return new Promise((resolve, reject) => {
    if (staticServer) {
      // Already running — reuse it
      resolve(staticServer.address().port);
      return;
    }

    function serveFile(res, filepath) {
      fs.readFile(filepath, (err, data) => {
        if (err) {
          res.writeHead(500); res.end("500 Error"); return;
        }
        res.writeHead(200, {
          "Content-Type": getMime(filepath),
          "Cache-Control": "no-cache",
        });
        res.end(data);
      });
    }

    function serveIndex(res) {
      serveFile(res, path.join(dir, "index.html"));
    }

    staticServer = http.createServer((req, res) => {
      const pathname = decodeURIComponent(req.url.split("?")[0]);
      const filePath = path.join(dir, pathname);

      // Security: block traversal
      if (!filePath.startsWith(dir)) {
        res.writeHead(403); res.end("403 Forbidden"); return;
      }

      fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
          serveFile(res, filePath);
        } else if (!err && stats.isDirectory()) {
          const idx = path.join(filePath, "index.html");
          fs.access(idx, fs.constants.F_OK, (e) => {
            if (e) serveIndex(res);
            else serveFile(res, idx);
          });
        } else {
          // SPA fallback
          serveIndex(res);
        }
      });
    });

    staticServer.on("error", (err) => {
      console.error("[staticServer] Error:", err.message);
      reject(err);
    });

    // Listen on port 0 = OS picks a free port automatically
    staticServer.listen(0, "127.0.0.1", () => {
      const port = staticServer.address().port;
      console.log(`[staticServer] Listening on http://127.0.0.1:${port}`);
      console.log(`[staticServer] Serving: ${dir}`);
      resolve(port);
    });
  });
}

// ── Window factory ──────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    const startURL = "http://localhost:3000/auth/login";
    console.log("[main] DEVELOPMENT mode: loading", startURL);
    win.loadURL(startURL).catch((err) => console.error("Failed to load URL:", err));
  } else {
    const frontendPath = path.join(
      process.resourcesPath,
      "app", "frontend", "out"
    );

    console.log("[main] PRODUCTION: frontend path:", frontendPath);
    console.log("[main] PRODUCTION: frontend exists:", fs.existsSync(frontendPath));

    if (!fs.existsSync(frontendPath)) {
      console.error("[main] ERROR: frontend not found at", frontendPath);
      win.loadURL(
        `data:text/html,<h1>Error: frontend not found.<br>Path: ${frontendPath}</h1>`
      );
      return;
    }

    startStaticServer(frontendPath)
      .then((port) => {
        const url = `http://localhost:${port}/auth/login`;
        console.log("[main] Loading:", url);
        win.loadURL(url).catch((err) =>
          console.error("Failed to load URL:", err)
        );
      })
      .catch((err) => {
        console.error("[main] Failed to start static server:", err.message);
        win.loadURL(
          `data:text/html,<h1>Error: static server failed.<br>${err.message}</h1>`
        );
      });
  }

  win.webContents.on("did-finish-load", () => {
    console.log("[main] Page finished loading");
  });
}

// ── IPC: generate-toc ───────────────────────────────────────────────────────
ipcMain.handle("generate-toc", async (_event, docPath) => {
  try {
    const result = await generateTOC(docPath);
    return { success: true, message: result };
  } catch (err) {
    console.error("[main] generate-toc error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── IPC: generate-toc-pdf ───────────────────────────────────────────────────
ipcMain.handle("generate-toc-pdf", async (_event, docPath) => {
  try {
    const result = await generateTOCAndExportPDF(docPath);
    return { success: true, ...result };
  } catch (err) {
    console.error("[main] generate-toc-pdf error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── IPC: save-docx-toc ──────────────────────────────────────────────────────
ipcMain.handle("save-docx-toc", async (_event, { base64, fileName }) => {
  let filePath = null;
  try {
    const downloadsDir = path.join(os.homedir(), "Downloads");
    if (!fs.existsSync(downloadsDir))
      fs.mkdirSync(downloadsDir, { recursive: true });

    filePath = path.join(downloadsDir, fileName);
    const buffer = Buffer.from(base64, "base64");
    fs.writeFileSync(filePath, buffer);
    console.log("[main] Docx saved to:", filePath);

    const tocResult = await generateTOC(filePath);
    console.log("[main] TOC updated:", tocResult);

    return { success: true, filePath };
  } catch (err) {
    console.error("[main] save-docx-toc error:", err.message);
    return { success: false, filePath, error: err.message };
  }
});

// ── IPC: process-docx-pdf ──────────────────────────────────────────────────
// ✅ NEW: Complete pipeline: save DOCX → update TOC → convert to PDF
// Saves to system temp directory for preview (auto-cleanup)
ipcMain.handle("process-docx-pdf", async (_event, { base64, fileName }) => {
  try {
    // ✅ Save to system temp instead of Downloads
    const previewTempDir = path.join(os.tmpdir(), "hpe-doc-preview");
    if (!fs.existsSync(previewTempDir)) {
      fs.mkdirSync(previewTempDir, { recursive: true });
    }

    // ✅ Clean up old preview files (older than 1 hour)
    try {
      const files = fs.readdirSync(previewTempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      files.forEach(file => {
        const filePath = path.join(previewTempDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      });
    } catch (cleanErr) {
      console.warn("[main] Old preview cleanup skipped:", cleanErr.message);
    }

    // ✅ Pass temp directory to processDOCXAndGeneratePDF
    const result = await processDOCXAndGeneratePDF(base64, fileName, previewTempDir);
    return result; // Returns { success, docxPath, pdfPath, docxFileName, pdfFileName, downloadDir }
  } catch (err) {
    console.error("[main] process-docx-pdf error:", err.message);
    return {
      success: false,
      error: err.message,
      docxPath: null,
      pdfPath: null,
    };
  }
});

// ── IPC: send-email-with-attachment ─────────────────────────────────────────
ipcMain.handle(
  "send-email-with-attachment",
  async (_event, { base64, fileName, subject, body, fileType }) => {
    let filePath = null;

    try {
      const downloadsDir = path.join(os.homedir(), "Downloads");
      if (!fs.existsSync(downloadsDir))
        fs.mkdirSync(downloadsDir, { recursive: true });

      filePath = path.join(downloadsDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      console.log("[main] File saved:", filePath);
    } catch (saveErr) {
      console.error("[main] save error:", saveErr.message);
      return { success: false, filePath: null, error: saveErr.message };
    }

    if (fileType === "docx") {
      try {
        await generateTOC(filePath);
        console.log("[main] TOC updated");
      } catch (tocErr) {
        console.warn("[main] TOC update skipped:", tocErr.message);
      }
    }

    if (process.platform === "win32") {
      try {
        const method = await _openOutlookWithAttachment(filePath, subject, body);
        console.log("[main] Email opened via:", method);
        return { success: true, filePath, method };
      } catch (outlookErr) {
        console.warn("[main] Outlook COM failed:", outlookErr.message, "— trying mailto fallback");
      }
    }

    try {
      const method = await _openMailtoFallback(filePath, subject, body);
      return { success: true, filePath, method };
    } catch (mailtoErr) {
      console.error("[main] mailto fallback failed:", mailtoErr.message);
      return { success: false, filePath, error: mailtoErr.message };
    }
  }
);

// ── Outlook helper ───────────────────────────────────────────────────────────
function _openOutlookWithAttachment(filePath, subject, body) {
  return new Promise((resolve, reject) => {
    const psEscape = (s = "") =>
      s
        .replace(/`/g, "``")
        .replace(/\$/g, "`$")
        .replace(/"/g, '`"')
        .replace(/\0/g, "");

    const psPath    = filePath.replace(/\\/g, "/");
    const psSubject = psEscape(subject || "");

    const scriptContent = [
      `$outlook = New-Object -ComObject Outlook.Application`,
      `$mail = $outlook.CreateItem(0)`,
      `$mail.Subject = "${psSubject}"`,
      `$mail.Body = @"`,
      body || "",
      `"@`,
      `$null = $mail.Attachments.Add("${psPath}")`,
      `$mail.Display()`,
    ].join("\r\n");

    const scriptPath = path.join(os.tmpdir(), `hpe_email_${Date.now()}.ps1`);
    try {
      fs.writeFileSync(scriptPath, scriptContent, { encoding: "utf8" });
    } catch (writeErr) {
      return reject(new Error(`PS1 write failed: ${writeErr.message}`));
    }

    const cmd = `powershell -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`;
    exec(cmd, { timeout: 15_000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(scriptPath); } catch (_) {}
      if (err) return reject(new Error(stderr?.trim() || err.message));
      resolve("outlook-com");
    });
  });
}

// ── mailto: fallback helper ──────────────────────────────────────────────────
async function _openMailtoFallback(filePath, subject, body) {
  const fullBody = [
    body || "",
    "",
    "---",
    `Attachment saved to: ${filePath}`,
    "(Please attach the file above before sending.)",
  ].join("\n");

  const mailtoUri =
    `mailto:?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(fullBody)}`;

  try { shell.showItemInFolder(filePath); } catch (_) {}

  await shell.openExternal(mailtoUri);
  return "mailto";
}

// ── IPC: select-file-path ─────────────────────────────────────────────────────
// ✅ NEW: Show save dialog to let user pick file location
ipcMain.handle("select-file-path", async (_event, { defaultPath, filters }) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(os.homedir(), "Downloads", defaultPath || "document"),
      filters: filters || [
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled) {
      return null;
    }

    return result.filePath;
  } catch (err) {
    console.error("[main] select-file-path error:", err.message);
    return null;
  }
});

// ── IPC: save-docx-with-path ─────────────────────────────────────────────────
// ✅ NEW: Save DOCX to user-selected path with TOC update
ipcMain.handle("save-docx-with-path", async (_event, { base64, filePath }) => {
  try {
    const buffer = Buffer.from(base64, "base64");
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);
    console.log("[main] DOCX saved to:", filePath);

    // Update TOC
    try {
      const tocResult = await generateTOC(filePath);
      console.log("[main] TOC updated successfully");
    } catch (tocErr) {
      console.warn("[main] TOC update skipped:", tocErr.message);
      // Don't fail - just continue without TOC
    }

    return { success: true, filePath };
  } catch (err) {
    console.error("[main] save-docx-with-path error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── IPC: save-file-with-path ─────────────────────────────────────────────────
// ✅ NEW: Save PDF/PPTX to user-selected path
ipcMain.handle("save-file-with-path", async (_event, { base64, filePath, fileType }) => {
  try {
    const buffer = Buffer.from(base64, "base64");
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);
    console.log(`[main] ${fileType.toUpperCase()} saved to:`, filePath);

    return { success: true, filePath };
  } catch (err) {
    console.error("[main] save-file-with-path error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── IPC: cleanup-preview-files ──────────────────────────────────────────────
// ✅ NEW: Clean up temporary preview files (DOCX/PDF/PPTX)
ipcMain.handle("cleanup-preview-files", async (_event, { filePaths }) => {
  try {
    if (!Array.isArray(filePaths)) {
      return { success: false, error: "filePaths must be an array" };
    }

    const deleted = [];
    const failed = [];

    for (const filePath of filePaths) {
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted.push(filePath);
          console.log("[main] Cleaned up preview file:", filePath);
        }
      } catch (err) {
        failed.push({ filePath, error: err.message });
        console.warn("[main] Failed to cleanup preview file:", filePath, err.message);
      }
    }

    return { success: true, deleted, failed };
  } catch (err) {
    console.error("[main] cleanup-preview-files error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  // Close the static server when all windows close
  if (staticServer) {
    staticServer.close(() => console.log("[staticServer] Closed"));
    staticServer = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});