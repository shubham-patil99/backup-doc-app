// routes/documentRoutes.js

const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const proposalController = require("../controllers/proposalController");
// const mailController  = require("../controllers/nodeMailer")

// Generate Word document from draft (using docxtemplater + Word COM post-processing)
router.post("/generate-document/:opeId", documentController.generateDocument);
router.post("/proposal/:opeId", proposalController.generateProposal);

// router.post("/send-document-mail/:opeId", documentController.sendDocumentMail);

module.exports = router;
