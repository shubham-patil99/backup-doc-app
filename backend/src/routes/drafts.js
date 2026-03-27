const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draftController");

// Save or Update Draft
router.post("/", draftController.saveDocument);

// Get All Drafts (👉 dashboard ke liye naya route)
router.get("/", draftController.getAllDrafts);

// In drafts.js
router.put("/autosave", draftController.autoSaveDraft);
router.put("/reset", draftController.resetDraft); // <-- add this\
router.put("/update-ope", draftController.updateOpeId);

// Delete all versions for an OPE
router.delete("/delete-all/:opeId", draftController.deleteAllVersionsForOpe);

// Get Draft by OPE
router.get("/:opeId", draftController.getDraftByOpe); 

// Delete Draft
router.delete("/:id", draftController.deleteDraft);

// Check Unique ope
router.get("/check-unique/:opeId", draftController.checkOpeUnique);

router.delete("/by-ope/:opeId", draftController.deleteDraftByOpe);

router.get("/:opeId/version/:version", draftController.getDraftByOpeAndVersion);

module.exports = router;
