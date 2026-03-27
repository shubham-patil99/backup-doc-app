const express = require('express');
const roleRoutes = require('./roleRoutes');
const userRoutes = require('./userRoutes');
const sectionRoutes = require('./sectionRoutes');
const moduleRoutes = require('./moduleRoutes');
const documentRoutes = require('./documentRoutes');
const authRoutes = require('./authRoutes'); 
const userModulePermissionRoutes = require('./userModulePermission');
const draftsRoutes = require("./drafts");
const userDashboardRoutes = require("./userDashboardRoutes");
const uploadRoutes = require("./upload");
const customerRoutes = require('./customerRoutes');
const engagementRoutes = require("./engagementRoutes");
const finalsRoutes = require('./finals');
const templateRoutes = require("./templateRoutes");
const RenderRoutes = require("./renderRoutes");

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/sections', sectionRoutes);
router.use('/modules', moduleRoutes);
router.use('/', documentRoutes);
router.use('/user-module-permissions', userModulePermissionRoutes);
router.use('/drafts', draftsRoutes);
router.use("/finals", finalsRoutes);
router.use("/user-dashboard", userDashboardRoutes);
router.use('/upload', uploadRoutes);
router.use('/customer', customerRoutes); // Changed to match frontend URL
router.use("/engagement", engagementRoutes);
router.use('/customers', customerRoutes);
router.use("/templates", templateRoutes);
router.use("/render", RenderRoutes);

module.exports = router;
