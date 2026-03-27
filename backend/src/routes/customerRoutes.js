const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

router.get("/", customerController.getCustomers); // list
router.get("/search", customerController.searchCustomers); // search
router.get("/:customerNo", customerController.getCustomerByNumber); // existing
router.post("/add-customer", customerController.addCustomer);
router.delete("/delete-customer/:id", customerController.deleteCustomer); // id = tblRid
router.put("/update-customer/:id", customerController.updateCustomer);

module.exports = router;