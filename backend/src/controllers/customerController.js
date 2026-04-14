const CustomerDetail = require("../models/customerDetail");
const { Op, literal, fn, col } = require("sequelize");
const sequelize = require("../config/database"); // adjust path if needed

exports.getCustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 15;
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
    if (!customer)
      return res.status(404).json({ success: false, error: "Customer not found" });
    res.json({ success: true, customer });
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customer" });
  }
};

exports.searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || !query.trim()) {
      // Return all (paginated) if no query
      const customers = await CustomerDetail.findAll({
        attributes: ["tblRid", "customerNo", "customerName", "country", "siteId"],
        order: [["customerName", "ASC"]],
        limit: 100,
      });
      return res.json({ success: true, results: customers });
    }

    const escaped = query.trim().replace(/[%_]/g, "\\$&"); // prevent LIKE injection

    // customer_no is INTEGER — must cast to TEXT for ILIKE
    // Using sequelize.literal for the cast
    const customers = await CustomerDetail.findAll({
      attributes: ["tblRid", "customerNo", "customerName", "country", "siteId"],
      where: {
        [Op.or]: [
          { customerName: { [Op.iLike]: `%${escaped}%` } },
          // Cast integer column to text before ILIKE
          literal(
            `CAST("CustomerDetail"."customer_no" AS TEXT) ILIKE '%${escaped}%'`
          ),
          { country: { [Op.iLike]: `%${escaped}%` } },
          { siteId: { [Op.iLike]: `%${escaped}%` } },
        ],
      },
      order: [["customerName", "ASC"]],
      limit: 100,
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
      return res
        .status(400)
        .json({ success: false, error: "customerNo and customerName are required" });
    }

    const dupNo = await CustomerDetail.findOne({ where: { customerNo } });
    if (dupNo)
      return res
        .status(409)
        .json({ success: false, error: "Customer number already exists", field: "customerNo" });

    const dupName = await CustomerDetail.findOne({ where: { customerName } });
    if (dupName)
      return res
        .status(409)
        .json({ success: false, error: "Customer name already exists", field: "customerName" });

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
    const { id } = req.params;
    const deleted = await CustomerDetail.destroy({ where: { tblRid: id } });
    if (!deleted)
      return res.status(404).json({ success: false, error: "Customer not found" });
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ success: false, error: "Failed to delete customer" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerNo, customerName, country, siteId } = req.body;
    if (!customerName)
      return res.status(400).json({ success: false, error: "customerName is required" });

    const existing = await CustomerDetail.findOne({ where: { tblRid: id } });
    if (!existing)
      return res.status(404).json({ success: false, error: "Customer not found" });

    if (customerNo && customerNo !== existing.customerNo) {
      const dup = await CustomerDetail.findOne({ where: { customerNo } });
      if (dup)
        return res
          .status(409)
          .json({ success: false, error: "Customer number already exists", field: "customerNo" });
    }
    if (customerName && customerName !== existing.customerName) {
      const dupN = await CustomerDetail.findOne({ where: { customerName } });
      if (dupN)
        return res
          .status(409)
          .json({ success: false, error: "Customer name already exists", field: "customerName" });
    }

    await CustomerDetail.update(
      {
        customerNo: customerNo || existing.customerNo,
        customerName,
        country: country || null,
        siteId: siteId || null,
      },
      { where: { tblRid: id }, returning: true }
    );
    const updated = await CustomerDetail.findOne({ where: { tblRid: id } });
    res.json({ success: true, message: "Customer updated successfully", data: updated });
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ success: false, error: "Failed to update customer" });
  }
};