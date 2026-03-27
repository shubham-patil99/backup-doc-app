import fs from "fs";
import { PDFDocument } from "pdf-lib";

export async function embedSignature(pdfPath, signatureBase64) {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    const signatureImage = await pdfDoc.embedPng(signatureBase64);
    const { width } = lastPage.getSize();

    // Draw the signature near bottom-right corner
    lastPage.drawImage(signatureImage, {
      x: width - 200,
      y: 80,
      width: 150,
      height: 60,
    });

    const signedPdfBytes = await pdfDoc.save();
    const signedPath = pdfPath.replace(".pdf", "_signed.pdf");
    fs.writeFileSync(signedPath, signedPdfBytes);

    return signedPath;
  } catch (error) {
    console.error("Failed to embed signature:", error);
    throw error;
  }
}
