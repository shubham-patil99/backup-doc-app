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
      return ipcRenderer
        .invoke("generate-toc", docPath)
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  generateTOCAndExportPDF: (docPath) => {
    try {
      return ipcRenderer
        .invoke("generate-toc-pdf", docPath)
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
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
      return ipcRenderer
        .invoke("save-docx-toc", { base64, fileName })
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  /**
   * ✅ NEW: Save document to Downloads, update TOC (if docx), and open email client with attachment.
   * Params: { base64, fileName, subject, body, fileType }
   * Returns: { success, filePath, error? }
   */
  sendEmailWithAttachment: (params) => {
    try {
      return ipcRenderer
        .invoke("send-email-with-attachment", params)
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  /**
   * ✅ Complete pipeline: base64 DOCX → Save → Update TOC → Generate PDF
   * Params: { base64, fileName }
   * Returns: { success, docxPath, pdfPath, docxFileName, pdfFileName, downloadDir, error? }
   */
  processDOCXAndGeneratePDF: (params) => {
    try {
      return ipcRenderer
        .invoke("process-docx-pdf", params)
        .then((result) => result || { success: false, error: "Null response from IPC", docxPath: null, pdfPath: null })
        .catch((err) => ({ success: false, error: String(err), docxPath: null, pdfPath: null }));
    } catch (err) {
      return Promise.resolve({
        success: false,
        error: String(err),
        docxPath: null,
        pdfPath: null,
      });
    }
  },

  /**
   * ✅ Show save dialog to let user pick file location
   * Params: { defaultPath, filters }
   * Returns: { selectedPath } or null if cancelled
   */
  selectFilePath: (options) => {
    try {
      return ipcRenderer
        .invoke("select-file-path", options)
        .then((result) => result || null)
        .catch((err) => {
          console.error("selectFilePath error:", err);
          return null;
        });
    } catch (err) {
      console.error("selectFilePath try-catch error:", err);
      return Promise.resolve(null);
    }
  },

  /**
   * ✅ Save DOCX to user-selected path with TOC update
   * Params: { base64, filePath }
   * Returns: { success, filePath, error? }
   */
  saveDocxWithPath: (base64, filePath) => {
    try {
      return ipcRenderer
        .invoke("save-docx-with-path", { base64, filePath })
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  /**
   * ✅ Save PDF/PPTX to user-selected path
   * Params: { base64, filePath, fileType }
   * Returns: { success, filePath, error? }
   */
  saveFileWithPath: (base64, filePath, fileType) => {
    try {
      return ipcRenderer
        .invoke("save-file-with-path", { base64, filePath, fileType })
        .then((result) => result || { success: false, error: "Null response" })
        .catch((err) => ({ success: false, error: String(err) }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err) });
    }
  },

  /**
   * ✅ Clean up temporary preview files (DOCX/PDF/PPTX)
   * Params: { filePaths: string[] }
   * Returns: { success, deleted: string[], failed: object[] }
   */
  cleanupPreviewFiles: (filePaths) => {
    try {
      return ipcRenderer
        .invoke("cleanup-preview-files", { filePaths })
        .then((result) => result || { success: false, error: "Null response", deleted: [], failed: [] })
        .catch((err) => ({ success: false, error: String(err), deleted: [], failed: [] }));
    } catch (err) {
      return Promise.resolve({ success: false, error: String(err), deleted: [], failed: [] });
    }
  },
});
