import express from "express";
import { getDocumentByToken, submitSignature } from "../controllers/signatureController.js";

const router = express.Router();

// serve the PDF for preview
router.get("/get-document/:token", getDocumentByToken);

// receive signature and embed it
router.post("/submit-signature/:token", submitSignature);

export default router;
