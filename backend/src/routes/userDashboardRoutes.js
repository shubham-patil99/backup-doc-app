const express = require("express");
const router = express.Router();
const userDashboardController = require("../controllers/userDashboardController");

router.get("/", userDashboardController.getUserDashboardData);

module.exports = router;
