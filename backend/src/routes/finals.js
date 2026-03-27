const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draftController");

// Save or Update Final
router.post("/", draftController.saveDocument); // Uses same controller, checks status

router.get("/", draftController.getAllFinals);

router.get("/:opeId", draftController.getFinalByOpe); // <-- Add this line

router.delete("/by-ope/:opeId", draftController.deleteFinalByOpe);

router.get("/:opeId/version/:version", draftController.getFinalByOpeAndVersion);

// You can add more routes for finals if needed

module.exports = router;