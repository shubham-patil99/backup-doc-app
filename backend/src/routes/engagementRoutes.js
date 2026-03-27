const express = require("express");
const router = express.Router();
const engagementController = require("../controllers/engagementController");

router.get("/roles", engagementController.getRoles);
router.get("/names", engagementController.getNamesByRole);

router.post("/add-resource", engagementController.addResource);
router.delete("/delete-resource/:id", engagementController.deleteResource);
router.put("/update-resource/:id", engagementController.updateResource);
router.get("/search", engagementController.searchMembers);
console.log("✅ engagementRoutes file loaded");

module.exports = router;
