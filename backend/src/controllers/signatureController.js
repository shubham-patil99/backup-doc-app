import fs from "fs";
import path from "path";
import { embedSignature } from "../utils/embedSignature.js";
import db from "../db.js"; // your postgres connection

// 🟢 Serve PDF for preview
export const getDocumentByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await db.query("SELECT pdf_path FROM documents WHERE signature_token = $1", [token]);
    if (result.rows.length === 0) return res.status(404).send("Invalid token");

    const pdfPath = result.rows[0].pdf_path;
    if (!fs.existsSync(pdfPath)) return res.status(404).send("File not found");

    res.setHeader("Content-Type", "application/pdf");
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error("Error loading PDF:", err);
    res.status(500).send("Server error");
  }
};

// 🖋️ Receive signature and embed
export const submitSignature = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature } = req.body;

    const result = await db.query("SELECT pdf_path FROM documents WHERE signature_token = $1", [token]);
    if (result.rows.length === 0) return res.status(404).send("Invalid token");

    const pdfPath = result.rows[0].pdf_path;

    // Embed the signature image into PDF
    const signedPath = await embedSignature(pdfPath, signature);

    // Update DB
    await db.query(
      "UPDATE documents SET signed = true, signed_pdf_path = $1 WHERE signature_token = $2",
      [signedPath, token]
    );

    res.json({ message: "Document signed successfully", signedPath });
  } catch (err) {
    console.error("Signature submission failed:", err);
    res.status(500).send("Error embedding signature");
  }
};
