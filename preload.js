/**
 * preload.js  – Electron preload (project root, alongside main.js)
 * Uses try/catch around every ipcRenderer call so a single failure
 * never crashes the entire sandbox bundle.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  generateTOC: (docPath) => {
    try {
      return ipcRenderer.invoke("generate-toc", docPath);
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  generateTOCAndExportPDF: (docPath) => {
    try {
      return ipcRenderer.invoke("generate-toc-pdf", docPath);
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  /**
   * Save a base64 docx to disk (Downloads folder) then update TOC via Word COM.
   * Returns the absolute saved path so the renderer can show it or trigger PDF export.
   */
  saveDocxAndUpdateTOC: (base64, fileName) => {
    try {
      return ipcRenderer.invoke("save-docx-toc", { base64, fileName });
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },
});
