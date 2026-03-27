const CustomerDetail = require("../models/customerDetail");
const { Op } = require("sequelize");

exports.getCustomers = async (req, res) => {
  try {
    // pagination params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 15
    const offset = (page - 1) * limit;

    const { count, rows } = await CustomerDetail.findAndCountAll({
      attributes: ["tblRid", "customerNo", "customerName", "country", "siteId"],
      order: [["customerName", "ASC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      customers: rows,
      total: count,
      page,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customers" });
  }
};

exports.getCustomerByNumber = async (req, res) => {
  try {
    const { customerNo } = req.params;
    const customer = await CustomerDetail.findOne({ where: { customerNo } });
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
    res.json({ success: true, customer });
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customer" });
  }
};

exports.searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;
    const where = {};
    if (query) {
      where.customerName = { [Op.iLike]: `%${query}%` };
    }
    const customers = await CustomerDetail.findAll({
      where,
      attributes: ["tblRid", "customerNo", "customerName", "country", "siteId"],
      order: [["customerName", "ASC"]],
      limit: 20,
    });
    res.json({ success: true, results: customers });
  } catch (err) {
    console.error("Error searching customers:", err);
    res.status(500).json({ success: false, error: "Failed to search customers" });
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { customerNo, customerName, country, siteId } = req.body;
    if (!customerNo || !customerName) {
      return res.status(400).json({ success: false, error: "customerNo and customerName are required" });
    }

    // Field-level uniqueness checks
    const dupNo = await CustomerDetail.findOne({ where: { customerNo } });
    if (dupNo) return res.status(409).json({ success: false, error: "Customer number already exists", field: "customerNo" });

    const dupName = await CustomerDetail.findOne({ where: { customerName } });
    if (dupName) return res.status(409).json({ success: false, error: "Customer name already exists", field: "customerName" });

    if (country) {
      const dupCountry = await CustomerDetail.findOne({ where: { country } });
      if (dupCountry) return res.status(409).json({ success: false, error: "Country value already exists", field: "country" });
    }

    if (siteId) {
      const dupSite = await CustomerDetail.findOne({ where: { siteId } });
      if (dupSite) return res.status(409).json({ success: false, error: "Site ID already exists", field: "siteId" });
    }

    const newCustomer = await CustomerDetail.create({
      customerNo,
      customerName,
      country: country || null,
      siteId: siteId || null,
    });
    res.json({ success: true, message: "Customer added successfully", data: newCustomer });
  } catch (err) {
    console.error("Error adding customer:", err);
    res.status(500).json({ success: false, error: "Failed to add customer" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params; // expecting tblRid
    const deleted = await CustomerDetail.destroy({ where: { tblRid: id } });
    if (!deleted) return res.status(404).json({ success: false, error: "Customer not found" });
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ success: false, error: "Failed to delete customer" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params; // tblRid
    const { customerNo, customerName, country, siteId } = req.body;
    if (!customerName) return res.status(400).json({ success: false, error: "customerName is required" });

    const existing = await CustomerDetail.findOne({ where: { tblRid: id } });
    if (!existing) return res.status(404).json({ success: false, error: "Customer not found" });

    // Field-level uniqueness checks (exclude current record)
    if (customerNo && customerNo !== existing.customerNo) {
      const dup = await CustomerDetail.findOne({ where: { customerNo } });
      if (dup) return res.status(409).json({ success: false, error: "Customer number already exists", field: "customerNo" });
    }
    if (customerName && customerName !== existing.customerName) {
      const dupN = await CustomerDetail.findOne({ where: { customerName } });
      if (dupN) return res.status(409).json({ success: false, error: "Customer name already exists", field: "customerName" });
    }
    if (country && country !== existing.country) {
      const dupC = await CustomerDetail.findOne({ where: { country } });
      if (dupC) return res.status(409).json({ success: false, error: "Country value already exists", field: "country" });
    }
    if (siteId && siteId !== existing.siteId) {
      const dupS = await CustomerDetail.findOne({ where: { siteId } });
      if (dupS) return res.status(409).json({ success: false, error: "Site ID already exists", field: "siteId" });
    }

    await CustomerDetail.update(
      { customerNo: customerNo || existing.customerNo, customerName, country: country || null, siteId: siteId || null },
      { where: { tblRid: id }, returning: true }
    );
    const updated = await CustomerDetail.findOne({ where: { tblRid: id } });
    res.json({ success: true, message: "Customer updated successfully", data: updated });
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ success: false, error: "Failed to update customer" });
  }
};