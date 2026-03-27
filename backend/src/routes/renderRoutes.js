const express = require("express");
const router = express.Router();
const renderController = require("../controllers/renderController");

router.get("/:opeId", renderController.getRenderData);

module.exports = router;