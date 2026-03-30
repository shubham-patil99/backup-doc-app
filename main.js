/**
 * main.js  – Electron main process
 * Place at project root alongside preload.js, wordCom.js, frontend/, backend/.
 */

const { app, BrowserWindow, ipcMain, shell, protocol } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
const { generateTOC, generateTOCAndExportPDF } = require("./wordCom");
const waitOn = require("wait-on");


// function registerAppProtocol() {
//   protocol.registerFileProtocol("app", (request, callback) => {
//     try {
//       const url = new URL(request.url);
//       let pathname = decodeURIComponent(url.pathname);

//       if (pathname === "/" || pathname === "") {
//         pathname = "/index.html";
//       }

//       if (!path.extname(pathname)) {
//         pathname = `${pathname}.html`;
//       }

//       const resolvedPath = path.normalize(
//         path.join(__dirname, "app/frontend/out", pathname)
//       );

//       console.log("[main] app protocol ->", request.url, "=>", resolvedPath);
//       callback({ path: resolvedPath });
//     } catch (error) {
//       console.error("[main] app protocol error:", error);
//       callback({ error: -6 }); // FILE_NOT_FOUND
//     }
//   });
// }

// ── Window factory ──────────────────────────────────────────────────────────
let nextProcess = null;

function startNextServer() {
  return new Promise((resolve, reject) => {
    console.log("[main] Starting Next.js server...");

    const frontendPath = app.isPackaged
      ? path.join(process.resourcesPath, "frontend")
      : path.join(__dirname, "frontend");

    const nextBin = path.join(
      frontendPath,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next"
    );

    nextProcess = exec(`"${nextBin}" start -p 3000`, {
      cwd: frontendPath,
    });

    nextProcess.stdout?.on("data", (data) => {
      console.log("[next]", data.toString());
    });

    nextProcess.stderr?.on("data", (data) => {
      console.error("[next error]", data.toString());
    });

    nextProcess.on("exit", (code) => {
      console.error("[main] Next.js server exited with code:", code);
    });

    // Wait until server is ready
    waitOn({
      resources: ["http://localhost:3000"],
      timeout: 30000,
      interval: 500,
    })
      .then(() => {
        console.log("[main] Next.js server is ready");
        resolve();
      })
      .catch((err) => {
        console.error("[main] waitOn failed:", err);
        reject(err);
      });
  });
}

async function createWindow() {
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
  const startURL = "http://localhost:3000/auth/login";

  console.log(`[main] Mode: ${isDev ? "DEV" : "PROD"}`);
  console.log("[main] Loading URL:", startURL);

  try {
    await win.loadURL(startURL);
  } catch (err) {
    console.error("[main] Failed to load URL:", err);
  }

  win.webContents.on("did-finish-load", () => {
    console.log("[main] Page finished loading");
  });

  if (isDev) {
    win.webContents.openDevTools();
  }
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

// ── IPC: send-email-with-attachment ─────────────────────────────────────────
//
// Flow:
//   1. Save base64 payload → Downloads/<fileName>
//   2. If docx → update TOC via Word COM (non-fatal if it fails)
//   3. Try Outlook COM via a temp PowerShell *script file* (avoids all
//      quote-escaping problems that plague -Command "..." invocations)
//   4. If Outlook fails / not Windows → fall back to mailto: URI via
//      shell.openExternal (opens whatever the user has set as their
//      default mail client: Outlook, Thunderbird, Apple Mail, etc.)
//      The attachment path is embedded so clients that support it
//      (e.g. Thunderbird with the right mailto handler) will pre-attach.
//
// Returns: { success, filePath, method, error? }
//   method: "outlook-com" | "mailto" | "mailto-fallback"

ipcMain.handle(
  "send-email-with-attachment",
  async (_event, { base64, fileName, subject, body, fileType }) => {
    let filePath = null;

    // ── Step 1: save file ──────────────────────────────────────────────────
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

    // ── Step 2: optional TOC update (docx only, non-fatal) ────────────────
    if (fileType === "docx") {
      try {
        await generateTOC(filePath);
        console.log("[main] TOC updated");
      } catch (tocErr) {
        console.warn("[main] TOC update skipped:", tocErr.message);
      }
    }

    // ── Step 3: Outlook COM via temp PS1 file (Windows only) ──────────────
    if (process.platform === "win32") {
      try {
        const method = await _openOutlookWithAttachment(filePath, subject, body);
        console.log("[main] Email opened via:", method);
        return { success: true, filePath, method };
      } catch (outlookErr) {
        console.warn("[main] Outlook COM failed:", outlookErr.message, "— trying mailto fallback");
      }
    }

    // ── Step 4: mailto: URI fallback (all platforms) ──────────────────────
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
//
// Writes a temporary .ps1 script so we never have to worry about quote
// escaping inside a -Command "..." string.  The script uses a here-string
// for the body so newlines are preserved exactly.

function _openOutlookWithAttachment(filePath, subject, body) {
  return new Promise((resolve, reject) => {
    // Escape only what PowerShell needs inside a double-quoted string:
    // backtick, dollar sign, double-quote, null.
    const psEscape = (s = "") =>
      s
        .replace(/`/g, "``")
        .replace(/\$/g, "`$")
        .replace(/"/g, '`"')
        .replace(/\0/g, "");

    // Use forward slashes — PowerShell handles them fine and avoids
    // double-backslash confusion in the script file itself.
    const psPath    = filePath.replace(/\\/g, "/");
    const psSubject = psEscape(subject || "");

    // Body: write as a PowerShell here-string (@" ... "@) so newlines
    // and special chars are preserved without any escaping at all.
    const scriptContent = [
      `$outlook = New-Object -ComObject Outlook.Application`,
      `$mail = $outlook.CreateItem(0)`,
      `$mail.Subject = "${psSubject}"`,
      `$mail.Body = @"`,
      body || "",          // raw body — here-string handles everything
      `"@`,
      `$null = $mail.Attachments.Add("${psPath}")`,
      `$mail.Display()`,
    ].join("\r\n");

    // Write script to a temp file
    const scriptPath = path.join(os.tmpdir(), `hpe_email_${Date.now()}.ps1`);
    try {
      fs.writeFileSync(scriptPath, scriptContent, { encoding: "utf8" });
    } catch (writeErr) {
      return reject(new Error(`PS1 write failed: ${writeErr.message}`));
    }

    // Execute the script file (no -Command quoting issues)
    const cmd = `powershell -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`;
    exec(cmd, { timeout: 15_000 }, (err, stdout, stderr) => {
      // Clean up the temp script regardless of outcome
      try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }

      if (err) {
        // Exit code 1 with empty stderr often means Outlook isn't installed
        return reject(new Error(stderr?.trim() || err.message));
      }
      resolve("outlook-com");
    });
  });
}

// ── mailto: fallback helper ──────────────────────────────────────────────────
//
// Opens the system's default mail client via a mailto: URI.
// Most desktop clients (Outlook, Thunderbird, Apple Mail) will pre-fill
// subject + body.  Attachment via mailto is intentionally NOT standard,
// so we instead show the saved file path in the body so the user can
// attach it manually — and we also reveal the file in Explorer/Finder
// so it's one click away.

async function _openMailtoFallback(filePath, subject, body) {
  // Append attachment hint to body
  const fullBody = [
    body || "",
    "",
    "---",
    `Attachment saved to: ${filePath}`,
    "(Please attach the file above before sending.)",
  ].join("\n");

  const mailtoUri =
    `mailto:?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(fullBody)}`;

  // Reveal file in Explorer / Finder so user can drag-attach in one click
  try {
    shell.showItemInFolder(filePath);
  } catch (_) { /* non-fatal */ }

  // Open default mail client
  await shell.openExternal(mailtoUri);
  return "mailto";
}

// ── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // registerAppProtocol();

  if (app.isPackaged) {
    await startNextServer();
  }

 await createWindow();
});

app.on("will-quit", () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});