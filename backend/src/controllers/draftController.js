const Draft = require("../models/draft");
const Final = require("../models/final");
const User = require("../models/user");
const CustomerDetail = require("../models/customerDetail"); // add require

// helper: resolve customerNo from customerName
const getCustomerNoByName = async (customerName) => {
  if (!customerName) return null;
  try {
    const c = await CustomerDetail.findOne({ where: { customerName } });
    return c?.customerNo ?? null;
  } catch (err) {
    console.error("getCustomerNoByName error:", err);
    return null;
  }
};

exports.autoSaveDraft = async (req, res) => {
  try {
    const { opeId, userId, content, version, customerName, partnerName, documentName, sowType, status, quoteId, ...rest } = req.body;

    // ✅ Add detailed logging
    console.log("📝 AutoSave Request:", {
      opeId,
      userId,
      customerName,
      documentName,
      quoteId,
      contentKeys: content ? Object.keys(content) : null,
      documentSectionsLength: content?.documentSections?.length,
      sowType,
      status,
      version
    });

    if (!opeId || !userId) {
      return res.status(400).json({ success: false, error: "OPE ID and User ID are required" });
    }

    // ✅ Normalize content - ensure we ALWAYS have a valid structure
    const normalizedContent = {
      documentSections: Array.isArray(content?.documentSections)
        ? content.documentSections.map(section => ({
            id: section.id,
            title: section.title || "",
            description: section.description || "",
            position: section.position,
            modules: Array.isArray(section.modules)
              ? section.modules.map((module, idx) => ({
                  id: module.id,
                  name: module.name || "",
                  description: module.description || "",
                  sectionId: section.id,
                  // Persist module order if provided; fall back to array order.
                  position: Number.isFinite(Number(module.position)) ? Number(module.position) : idx
                }))
              : []
          }))
        : []
    };

    console.log("📝 Normalized content:", JSON.stringify(normalizedContent).substring(0, 200));

    // Find latest draft for this OPE/user
    const latestDraft = await Draft.findOne({
      where: { opeId, userId },
      order: [["version", "DESC"]],
    });

    if (latestDraft) {
      console.log("📝 Found existing draft, updating...");

      // ✅ NEW: If incoming content is empty but existing draft has content, preserve existing content
      const shouldUpdateContent = !(normalizedContent.documentSections.length === 0 && latestDraft.content?.documentSections?.length > 0);
      if (!shouldUpdateContent) {
        console.log("📝 Skipping content update to preserve existing non-empty content for OPE:", opeId);
      }

      try {
        await latestDraft.update({
          customerName: customerName !== undefined ? customerName : latestDraft.customerName,
          partnerName: partnerName !== undefined ? partnerName : latestDraft.partnerName,
          documentName: documentName !== undefined ? documentName : latestDraft.documentName,
          quoteId: quoteId === "" ? null : (quoteId !== undefined ? quoteId : latestDraft.quoteId),
          sowType: sowType !== undefined ? sowType : (latestDraft.sowType || 'FULL'),
          ...(shouldUpdateContent && { content: normalizedContent }),  // Only update content if not skipping
          status: status || latestDraft.status,
          version: latestDraft.version,
          ...rest
        });

        await latestDraft.reload();
        const latestDraftJson = latestDraft.toJSON();
        latestDraftJson.customerNo = await getCustomerNoByName(latestDraftJson.customerName);
        console.log("✅ Updated existing draft v" + latestDraft.version + (shouldUpdateContent ? " (content updated)" : " (content preserved)"));
        return res.json({ success: true, draft: latestDraftJson });
      } catch (updateError) {
        console.error("❌ Update failed:", updateError);
        console.error("❌ Error name:", updateError.name);
        console.error("❌ Error message:", updateError.message);
        
        if (updateError.errors) {
          console.error("❌ Validation errors:", updateError.errors.map(e => ({
            field: e.path,
            message: e.message,
            type: e.type,
            value: e.value
          })));
          
          return res.status(400).json({
            success: false,
            error: "Validation error on update",
            details: updateError.errors.map(e => `${e.path}: ${e.message}`)
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          error: "Failed to update existing draft", 
          details: updateError.message 
        });
      }
    } else {
      console.log("📝 No existing draft found, creating new one...");
      if (normalizedContent.documentSections.length === 0) {
        console.log("📝 Skipping creation of empty draft for OPE:", opeId);
        return res.json({ success: true, draft: null, note: "no-content-to-save" });
      }
      // ✅ Prepare create payload with all required fields
      const createPayload = {
        opeId,
        userId,
        customerName: customerName || null,
        partnerName: partnerName || null,
        documentName: documentName || null,
        sowType: sowType || 'FULL',
        content: normalizedContent,
        status: status || "draft",
        version: 1,
        quoteId: quoteId || null,
        ...rest
      };

      console.log("📝 Create payload:", JSON.stringify(createPayload).substring(0, 300));

      try {
        const draft = await Draft.create(createPayload);
        const draftJson = draft.toJSON();
        draftJson.customerNo = await getCustomerNoByName(draftJson.customerName);
        console.log("✅ Created new draft v1");
        return res.json({ success: true, draft: draftJson });
      } catch (createError) {
        console.error("❌ Create failed:", createError);
        console.error("❌ Error name:", createError.name);
        console.error("❌ Error message:", createError.message);
        
        // ✅ Validation errors
        if (createError.name === "SequelizeValidationError" && Array.isArray(createError.errors)) {
          console.error("❌ Validation errors:", createError.errors.map(e => ({
            field: e.path,
            message: e.message,
            type: e.type,
            value: e.value,
            validatorKey: e.validatorKey
          })));
          
          return res.status(400).json({
            success: false,
            error: "Validation error",
            details: createError.errors.map(e => `${e.path}: ${e.message} (value: ${JSON.stringify(e.value)})`)
          });
        }

        // Handle unique constraint violation (race)
        const isUniqueViolation =
          createError &&
          (createError.name === "SequelizeUniqueConstraintError" ||
            (createError.original && createError.original.code === "23505"));

        if (isUniqueViolation) {
          console.log("⚠️ Unique constraint violation, retrying by searching conflicting row by opeId...");

          try {
            // Find the existing conflicting draft by opeId (not restricted to userId)
            const existing = await Draft.findOne({
              where: { opeId },
              order: [["version", "DESC"]],
            });

              if (existing) {
              // Update the found draft (merge)
              await existing.update({
                customerName: customerName !== undefined ? customerName : existing.customerName,
                partnerName: partnerName !== undefined ? partnerName : existing.partnerName,
                documentName: documentName !== undefined ? documentName : existing.documentName,
                sowType: sowType !== undefined ? sowType : (existing.sowType || 'FULL'),
                content: normalizedContent,
                status: status || existing.status,
                version: existing.version,
                ...rest
              });

              await existing.reload();
              console.log("✅ Updated concurrent existing draft (merged)");
              const existingJson = existing.toJSON();
              existingJson.customerNo = await getCustomerNoByName(existingJson.customerName);
              return res.json({ success: true, draft: existingJson, note: "created-concurrently, merged-existing" });
            } else {
              // No existing row found (unexpected) — surface conflict to client
              console.error("⚠️ Unique violation but no existing row found for opeId:", opeId);
              return res.status(409).json({
                success: false,
                error: "Conflict: draft version already exists for this OPE ID",
                details: createError.message
              });
            }
          } catch (retryErr) {
            console.error("❌ Retry after unique violation failed:", retryErr);
            return res.status(500).json({ success: false, error: "Failed to create or merge draft after conflict", details: retryErr.message });
          }
        }

        // fallback
        return res.status(500).json({ 
          success: false, 
          error: "Failed to create draft", 
          details: createError.message || "Unknown error"
        });
      }
    }
  } catch (error) {
    console.error("❌ Auto-save draft error:", error);
    console.error("❌ Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: "Failed to auto-save draft", 
      details: error.message 
    });
  }
};

exports.resetDraft = async (req, res) => {
  try {
    const { opeId, userId } = req.body;
    if (!opeId || !userId) {
      return res.status(400).json({ success: false, error: "opeId and userId required" });
    }

    // find latest draft for this OPE/user
    const latestDraft = await Draft.findOne({
      where: { opeId, userId },
      order: [["version", "DESC"]],
    });

    if (latestDraft) {
      // set content to empty documentSections (preserve version)
      await latestDraft.update({
        content: { documentSections: [] },
      });
      const latestJson = latestDraft.toJSON();
      latestJson.customerNo = await getCustomerNoByName(latestJson.customerName);
      return res.json({ success: true, draft: latestJson });
    }

    // if no draft exists, create an empty draft record (version 1)
    const created = await Draft.create({
      opeId,
      userId,
      customerName: null,
      partnerName: null,
      documentName: null,
      content: { documentSections: [] },
      status: "draft",
      version: 1,
    });
    const createdJson = created.toJSON();
    createdJson.customerNo = await getCustomerNoByName(createdJson.customerName);
    return res.json({ success: true, draft: createdJson });
  } catch (err) {
    console.error("❌ resetDraft error:", err);
    return res.status(500).json({ success: false, error: "Failed to reset draft", details: err.message });
  }
};

// ... rest of your controller functions remain the same ...

exports.saveDocument = async (req, res) => {
  try {
    const {
      opeId,
      userId,
      customerName,
      customerEmail,
      partnerName,
      customerAddress,
      addresses,
      engagementResources,
      content,
      status,
      fileName,
      sowType,
      quoteId,
    } = req.body;

    const finalAddress = customerAddress || addresses || null;

    if (status === "final") {
      const lastFinal = await Final.findOne({
        where: { opeId },
        order: [["version", "DESC"]],
      });
      const latestVersion = lastFinal ? lastFinal.version : 0;

      // ✅ Fallback to previous version's customer fields if not provided
      const prevCustomerName = !customerName ? lastFinal?.customerName : customerName;
      const prevCustomerEmail = !customerEmail ? lastFinal?.customerEmail : customerEmail;
      const prevPartnerName = !partnerName ? lastFinal?.partnerName : partnerName;
      const prevCustomerAddress = !finalAddress ? lastFinal?.customerAddress : finalAddress;
      const prevEngagementResources = !engagementResources ? lastFinal?.engagementResources : engagementResources;
      const prevQuoteId = !quoteId ? lastFinal?.quoteId : quoteId;

      const final = await Final.create({
        opeId,
        userId,
        customerName: prevCustomerName,
        customerEmail: prevCustomerEmail,
        partnerName: prevPartnerName || null,
        customerAddress: prevCustomerAddress,
        engagementResources: prevEngagementResources || [],
        sowType: sowType !== undefined ? sowType : (lastFinal?.sowType || 'FULL'),
        content,
        status: "final",
        version: latestVersion + 1,
        fileName,
        quoteId: prevQuoteId || null,
      });
      const finalJson = final.toJSON();
      finalJson.customerNo = await getCustomerNoByName(finalJson.customerName);
      return res.json({ success: true, final: finalJson });
    } else {
      const lastDraft = await Draft.findOne({
        where: { opeId },
        order: [["version", "DESC"]],
      });
      const latestVersion = lastDraft ? lastDraft.version : 0;

      // ✅ Fallback to previous version's customer fields if not provided
      const prevCustomerName = !customerName ? lastDraft?.customerName : customerName;
      const prevCustomerEmail = !customerEmail ? lastDraft?.customerEmail : customerEmail;
      const prevPartnerName = !partnerName ? lastDraft?.partnerName : partnerName;
      const prevCustomerAddress = !finalAddress ? lastDraft?.customerAddress : finalAddress;
      const prevEngagementResources = !engagementResources ? lastDraft?.engagementResources : engagementResources;
      const prevQuoteId = !quoteId ? lastDraft?.quoteId : quoteId;

      const nextVersion = latestVersion + 1;
      const existingDraft = await Draft.findOne({ where: { opeId, version: nextVersion } });
      if (existingDraft) {
        await existingDraft.update({
          userId,
          customerName: prevCustomerName,
          customerEmail: prevCustomerEmail,
          partnerName: prevPartnerName || null,
          customerAddress: prevCustomerAddress,
          engagementResources: prevEngagementResources || [],
          sowType: sowType !== undefined ? sowType : (existingDraft.sowType || 'FULL'),
          content,
          status: "draft",
          fileName,
        });
        await existingDraft.reload();
        const existingJson = existingDraft.toJSON();
        existingJson.customerNo = await getCustomerNoByName(existingJson.customerName);
        return res.json({ success: true, draft: existingJson });
      }

      const draft = await Draft.create({
        opeId,
        userId,
        customerName: prevCustomerName,
        customerEmail: prevCustomerEmail,
        partnerName: prevPartnerName || null,
        customerAddress: prevCustomerAddress,
        engagementResources: prevEngagementResources || [],
        sowType: sowType !== undefined ? sowType : (lastDraft?.sowType || 'FULL'),
        content,
        status: "draft",
        version: nextVersion,
        fileName,
        quoteId: prevQuoteId || null,
      });
      const draftJson2 = draft.toJSON();
      draftJson2.customerNo = await getCustomerNoByName(draftJson2.customerName);
      return res.json({ success: true, draft: draftJson2 });
    }
  } catch (error) {
    console.error("Error saving document:", error);
    res.status(500).json({ success: false, error: "Failed to save document" });
  }
};

exports.getDraftByOpeAndVersion = async (req, res) => {
  try {
    const { opeId, version } = req.params;
    // First try to find a draft record for the requested version
    const draft = await Draft.findOne({ where: { opeId, version } });
    if (draft) {
      const d = draft.toJSON();
      d.customerNo = await getCustomerNoByName(d.customerName);
      return res.json({ success: true, draft: d });
    }

    // If there is no draft with that version, try the finals table as a fallback.
    // In some workflows a version may have been promoted to `final` and the
    // frontend may still request the version via the drafts endpoint. Returning
    // the final record here prevents the UI from missing top-level fields
    // such as customerName / partnerName / quoteId.
    const final = await Final.findOne({ where: { opeId, version } });
    if (final) {
      const f = final.toJSON();
      f.customerNo = await getCustomerNoByName(f.customerName);
      return res.json({ success: true, final: f });
    }

    return res.status(404).json({ success: false, error: "Version not found" });
  } catch (error) {
    console.error("Error fetching draft by OPE and version:", error);
    res.status(500).json({ success: false, error: "Failed to fetch draft" });
  }
};

exports.getFinalByOpeAndVersion = async (req, res) => {
  try {
    const { opeId, version } = req.params;
    const final = await Final.findOne({ where: { opeId, version } });
    if (!final) {
      return res.status(404).json({ success: false, error: "Final not found" });
    }
    const finalJson = final.toJSON();
    finalJson.customerNo = await getCustomerNoByName(finalJson.customerName);
    res.json({ success: true, final: finalJson });
  } catch (error) {
    console.error("Error fetching final by OPE and version:", error);
    res.status(500).json({ success: false, error: "Failed to fetch final" });
  }
};

exports.getAllDrafts = async (req, res) => {
  try {
    const { opeId } = req.query;
    const where = { status: "draft" }; // ✅ ADD THIS
    if (opeId) where.opeId = opeId;
    const drafts = await Draft.findAll({
      where,
      include: [{ model: User, as: "user", attributes: ["name", "email"] }],
      order: [["version", "ASC"]],
    });
    const draftsWithNo = await Promise.all(drafts.map(async draft => {
      const obj = draft.toJSON();
      obj.customerNo = await getCustomerNoByName(obj.customerName);
      return {
        opeId: obj.opeId,
        version: obj.version,
        createdAt: obj.createdAt,
        userName: obj.user?.name || "",
        userEmail: obj.user?.email || "",
        status: obj.status,
        fileName: obj.fileName || "",
        customerName: obj.customerName || "",
        customerNo: obj.customerNo,
        customerEmail: obj.customerEmail || "",
        partnerName: obj.partnerName || "",
        customerAddress: obj.customerAddress || "",
        engagementResources: obj.engagementResources || [],
        content: obj.content || {},
      };
    }));
    res.json({ success: true, drafts: draftsWithNo });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch drafts" });
  }
};

exports.getAllFinals = async (req, res) => {
  try {
    const { opeId, userId } = req.query;
    const where = { status: "final" }; // ✅ ADD THIS
    if (opeId) where.opeId = opeId;
    if (userId) where.userId = userId;
    const finals = await Final.findAll({
      where,
      include: [{ model: User, as: "user", attributes: ["name", "email"] }],
      order: [["version", "ASC"]],
    });
    const finalsWithNo = await Promise.all(finals.map(async final => {
      const obj = final.toJSON();
      obj.customerNo = await getCustomerNoByName(obj.customerName);
      return {
        opeId: obj.opeId,
        version: obj.version,
        createdAt: obj.createdAt,
        userName: obj.user?.name || "",
        userEmail: obj.user?.email || "",
        status: obj.status,
        fileName: obj.fileName || "",
        customerName: obj.customerName || "",
        customerNo: obj.customerNo,
        customerEmail: obj.customerEmail || "",
        partnerName: obj.partnerName || "",
        customerAddress: obj.customerAddress || "",
        engagementResources: obj.engagementResources || [],
        content: obj.content || {},
      };
    }));
    res.json({ success: true, finals: finalsWithNo });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch finals" });
  }
};

exports.getDraftByOpe = async (req, res) => {
  try {
    const { opeId } = req.params;
    console.log("[getDraftByOpe] Fetching draft for OPE:", opeId);
    
    // ✅ Always fetch LATEST draft version for this OPE
    // Use explicit attributes to avoid selecting columns that don't exist
    const draft = await Draft.findOne({
      where: { opeId, status: "draft" }, // also filter by status
      order: [["version", "DESC"]], // GET LATEST
      attributes: ['id', 'opeId', 'userId', 'customerName', 'customerEmail', 'partnerName', 'customerAddress', 'content', 'sowType', 'status', 'version', 'fileName', 'quoteId', 'createdAt', 'updatedAt']
    });
    
    console.log("[getDraftByOpe] Draft found:", draft ? "Yes" : "No");
    
    if (!draft) {
      // No draft found — try returning the latest final as a fallback so the
      // frontend still receives top-level fields (customerName, partnerName, quoteId)
      const latestFinal = await Final.findOne({ where: { opeId }, order: [["version", "DESC"]] });
      if (latestFinal) {
        console.log("[getDraftByOpe] No draft, returning latest final as draft fallback");
        const finalJson = latestFinal.toJSON();
        finalJson.customerNo = await getCustomerNoByName(finalJson.customerName);
        return res.json({ success: true, draft: finalJson });
      }
      return res.status(404).json({ success: false, error: "Draft not found" });
    }
    const out = draft.toJSON();
    out.customerNo = await getCustomerNoByName(out.customerName);
    res.json({ success: true, draft: out });
  } catch (error) {
    console.error("[getDraftByOpe] Error fetching draft:", error.message);
    console.error("[getDraftByOpe] Stack:", error.stack);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch draft" });
  }
};

exports.getFinalByOpe = async (req, res) => {
  try {
    const { opeId } = req.params;
    const { userId } = req.query;
    // ✅ Always fetch LATEST final version
    const final = await Final.findOne({
      where: { opeId, userId, status: "final" }, // also filter by status
      order: [["version", "DESC"]], // GET LATEST
    });
    if (!final) {
      return res.status(404).json({ success: false, error: "Final not found" });
    }
    const finalJson = final.toJSON();
    finalJson.customerNo = await getCustomerNoByName(finalJson.customerName);
    res.json({ success: true, final: finalJson });
  } catch (error) {
    console.error("Error fetching final:", error);
    res.status(500).json({ success: false, error: "Failed to fetch final" });
  }
};

exports.deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    await Draft.destroy({ where: { id } });
    res.json({ success: true, message: "Draft deleted successfully" });
  } catch (error) {
    console.error("Error deleting draft:", error);
    res.status(500).json({ success: false, error: "Failed to delete draft" });
  }
};

exports.checkOpeUnique = async (req, res) => {
  try {
    const { opeId } = req.params;

    // Check both Drafts and Finals for the same opeId
    const [draft, final] = await Promise.all([
      Draft.findOne({ where: { opeId, status: "draft" } }),
      Final.findOne({ where: { opeId, status: "final" } }),
    ]);

    if (draft || final) return res.json({ unique: false });
    return res.json({ unique: true });
  } catch (error) {
    console.error("Error checking OPE ID uniqueness:", error);
    res.status(500).json({ success: false, error: "Failed to check OPE ID" });
  }
};

exports.updateOpeId = async (req, res) => {
  try {
    const { oldOpeId, newOpeId, userId } = req.body;

    if (!oldOpeId || !newOpeId) {
      return res.status(400).json({
        success: false,
        error: "Both oldOpeId and newOpeId are required",
      });
    }

    const existing = await Draft.findOne({ where: { opeId: newOpeId } });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "OPE ID already exists. Please choose another one.",
      });
    }

    const latestOldDraft = await Draft.findOne({
      where: { opeId: oldOpeId },
      order: [["version", "DESC"]],
    });

    if (!latestOldDraft) {
      return res.status(404).json({
        success: false,
        error: "No draft found for the given old OPE ID.",
      });
    }

    const newDraft = await Draft.create({
      opeId: newOpeId,
      userId: userId || latestOldDraft.userId,
      customerName: latestOldDraft.customerName,
      customerEmail: latestOldDraft.customerEmail,
      partnerName: latestOldDraft.partnerName,
      customerAddress: latestOldDraft.customerAddress,
      engagementResources: latestOldDraft.engagementResources,
      content: latestOldDraft.content,
      fileName: latestOldDraft.fileName,
      quoteId: latestOldDraft.quoteId,
      status: "draft",
      version: 1,
    });

    const newDraftJson = newDraft.toJSON();
    newDraftJson.customerNo = await getCustomerNoByName(newDraftJson.customerName);
    return res.json({
      success: true,
      message: "New OPE ID created successfully with version 1.",
      draft: newDraftJson,
    });
  } catch (error) {
    console.error("Error updating OPE ID:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update OPE ID.",
    });
  }
};

exports.deleteAllVersionsForOpe = async (req, res) => {
  try {
    const { opeId } = req.params;

    if (!opeId) {
      return res.status(400).json({
        success: false,
        error: "OPE ID is required",
      });
    }

    console.log("🗑️ Deleting all versions for OPE:", opeId);

    // Delete all drafts and finals for this OPE
    const [draftCount, finalCount] = await Promise.all([
      Draft.destroy({ where: { opeId } }),
      Final.destroy({ where: { opeId } })
    ]);

    console.log(`✅ Deleted ${draftCount} draft(s) and ${finalCount} final(s) for OPE: ${opeId}`);

    return res.json({
      success: true,
      message: `Deleted ${draftCount} draft(s) and ${finalCount} final(s) for OPE: ${opeId}`,
      deletedDrafts: draftCount,
      deletedFinals: finalCount
    });
  } catch (error) {
    console.error("❌ Error deleting all versions for OPE:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete document",
      details: error.message
    });
  }
};

exports.deleteDraftByOpe = async (req, res) => {
  try {
    const { opeId } = req.params;
    const deleted = await Draft.destroy({ where: { opeId } });
    res.json({ success: true, message: `Deleted ${deleted} draft(s)`, deletedCount: deleted });
  } catch (error) {
    console.error("Error deleting drafts by OPE:", error);
    res.status(500).json({ success: false, error: "Failed to delete drafts by OPE" });
  }
};

exports.deleteFinalByOpe = async (req, res) => {
  try {
    const { opeId } = req.params;
    const deleted = await Final.destroy({ where: { opeId } });
    res.json({ success: true, message: `Deleted ${deleted} final(s)`, deletedCount: deleted });
  } catch (error) {
    console.error("Error deleting finals by OPE:", error);
    res.status(500).json({ success: false, error: "Failed to delete finals by OPE" });
  }
};