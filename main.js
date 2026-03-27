/**
 * main.js  – Electron main process
 * Place at project root alongside preload.js, wordCom.js, frontend/, backend/.
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { generateTOC, generateTOCAndExportPDF } = require("./wordCom");

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

  const devURL = "http://localhost:3000/auth/login";
  console.log("Loading Electron dev URL:", devURL);

  win
    .loadURL(devURL)
    .catch((err) => console.error("Failed to load dev URL:", err));

  win.webContents.on("did-finish-load", () => {
    console.log("Electron finished loading page.");
  });

  win.webContents.openDevTools(); // remove in production
}

// ── IPC: generate-toc ───────────────────────────────────────────────────────
// Called when renderer already has the file on disk (rare case).
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
// Main flow: renderer sends base64 docx → main saves to Downloads → updates TOC.
// This is the correct pattern because the renderer has no fs access.
ipcMain.handle("save-docx-toc", async (_event, { base64, fileName }) => {
  let filePath = null;
  try {
    // Save to user's Downloads folder
    const downloadsDir = path.join(os.homedir(), "Downloads");
    if (!fs.existsSync(downloadsDir))
      fs.mkdirSync(downloadsDir, { recursive: true });

    filePath = path.join(downloadsDir, fileName);
    const buffer = Buffer.from(base64, "base64");
    fs.writeFileSync(filePath, buffer);
    console.log("[main] Docx saved to:", filePath);

    // Update TOC via Word COM
    const tocResult = await generateTOC(filePath);
    console.log("[main] TOC updated:", tocResult);

    return { success: true, filePath };
  } catch (err) {
    console.error("[main] save-docx-toc error:", err.message);
    // Still return filePath if save succeeded but TOC failed
    return { success: false, filePath, error: err.message };
  }
});

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
