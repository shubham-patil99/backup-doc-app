// @ts-nocheck
"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Layer,
  TextInput,
  Text,
  CheckBox,
  FormField,
  Grid,
} from "grommet";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/apiClient";
import EngagementResourceRow from "./EngagementResourceRow";

interface FormProps {
  userId: number | null;
  onClose: () => void;
}

const ADDRESS_TYPES = ["Sold To", "Invoice", "Delivery"];

export default function CreateDocumentForm({ userId, onClose }: FormProps) {
  const router = useRouter();

  // Basic info
  const [opeId, setOpeId] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quoteId, setQuoteId] = useState("");

  // Partner info
  const [isPartnerLed, setIsPartnerLed] = useState(false);
  const [partnerName, setPartnerName] = useState("");

  // Engagement Resources
  const [engagementResources, setEngagementResources] = useState<
    { role: string; name: string }[]
  >([]);

  // Errors & submission
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [checkingOpe, setCheckingOpe] = useState(false);
  const [isOpeUnique, setIsOpeUnique] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Validation
  const validateFields = () => {
    const newErrors: { [key: string]: string } = {};


    // OPE ID
    if (!opeId) {
      newErrors.opeId = "OPE ID is required";
    } else if (!/^OPE-(\d{10}|HOLD\d+|EXCP\d+)$/.test(opeId)) {
      newErrors.opeId =
        "OPE ID must be in formats: OPE-1234567890, OPE-HOLD123456, OPE-EXCP123456";
    }

    // Customer
    if (!customerName) newErrors.customerName = "Customer name is required";
    if (!customerNo) newErrors.customerNo = "Customer number is required";

    // Partner
    if (isPartnerLed && !partnerName.trim()) {
      newErrors.partnerName = "Partner name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check OPE uniqueness
  const checkOpeUnique = async () => {
    if (!opeId) return;
    setCheckingOpe(true);

    try {
      const data = await apiFetch(`/drafts/check-unique/${opeId}`);
      setIsOpeUnique(!!data?.unique);

      if (!data?.unique) {
        setErrors((prev) => ({ ...prev, opeId: "OPE ID already exists" }));
      } else {
        setErrors((prev) => {
          const { opeId: _ignored, ...rest } = prev;
          return rest;
        });
      }
    } catch (err) {
      console.error("Error checking OPE ID uniqueness:", err);
      setErrors((prev) => ({ ...prev, opeId: "Failed to check uniqueness" }));
    } finally {
      setCheckingOpe(false);
    }
  };

  // Submit handler
  const handleCreateSOW = async () => {
    if (!validateFields() || !isOpeUnique || submitting) return;
    setSubmitting(true);
   const fileName =  partnerName && partnerName.trim()  
                  ? `${opeId} - HPE Nonstop PSD SOW to ${partnerName} for ${customerName}_draft_v1.docx`
                  : `${opeId} - HPE Nonstop PSD SOW for ${customerName}_draft_v1.docx`;

    try {
      const payload = {
        opeId,
        userId,
        customerName,
        customerNo,
        partnerName: isPartnerLed ? partnerName : null,
        engagementResources,
        content: { title: "" },
        fileName,
        status: "draft",
      };

      const data = await apiFetch("/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!data?.success || !data?.draft) {
        console.error("Failed to save draft:", data?.error || data);
        return;
      }

      // ✅ FIX 1: Store OPE ID in localStorage immediately after successful creation
      if (typeof window !== "undefined") {
        localStorage.setItem("currentOpeId", opeId);
        
        // ✅ FIX 2: Store customer info in localStorage for immediate access
        const customerInfo = {
          customerName,
          customerNo,
          partnerName: isPartnerLed ? partnerName : "",
        };
        localStorage.setItem("customerInfo", JSON.stringify(customerInfo));
      }

      onClose();
      
      // ✅ FIX 3: Add a small delay and force refresh to ensure data is loaded

      setTimeout(() => {
        router.push(
          `/dashboard/user/create-document?opeId=${encodeURIComponent(opeId)}&refresh=${Date.now()}`
        );
      }, 100);
      
    } catch (err) {
      console.error("Error creating SOW:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch customer details
  const fetchCustomerDetails = async () => {
    if (!customerNo) return;
    try {
      const data = await apiFetch(`/customer/${customerNo}`);
      if (data.success && data.customer) {
        setCustomerName(data.customer.customerName);
        setErrors(prev => ({ ...prev, customerNo: undefined }));
      } else {
        setCustomerName("");
        setErrors(prev => ({
          ...prev,
          customerNo: "Customer not found"
        }));
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setErrors(prev => ({
        ...prev,
        customerNo: "Failed to fetch customer details"
      }));
    }
  };

  return (
    <Layer onEsc={onClose} onClickOutside={onClose} modal style={{ position: "fixed", zIndex: 9999, padding: "10px" }}>
      <Box pad="medium" gap="small" width="large" overflow="auto" style={{ maxHeight: "100%" }}>
        <Grid  gap="medium">
          {/* columns={["1/2", "1/2"]} */}
          {/* Left Column -> Customer Info */}
          <Box gap="small">
            <Text >OPE ID</Text>
              <TextInput
                value={opeId}
                onChange={(e) => {
                  let val = e.target.value.toUpperCase();

                  // Always ensure prefix
                  if (!val.startsWith("OPE-")) {
                    val = "OPE-" + val.replace(/^OPE-?/i, "");
                  }

                  let suffix = val.slice(4); // after OPE-

                  // Stop if suffix has invalid chars
                  if (!/^[A-Z0-9]*$/.test(suffix)) return;

                  // ✅ Rule 1: Pure numeric (standard OPE)
                  if (/^\d+$/.test(suffix)) {
                    if (suffix.length > 10) return; // max 10 digits
                  }

                  // ✅ Rule 2: HOLD + 6 digits
                  if (suffix.startsWith("HOLD")) {
                    const afterHold = suffix.slice(4);
                    if (!/^\d*$/.test(afterHold)) return; // only digits after HOLD
                    if (afterHold.length > 6) return; // max 6 digits
                  }

                  // ✅ Rule 3: EXCP + 6 digits
                  if (suffix.startsWith("EXCP")) {
                    const afterExcp = suffix.slice(4);
                    if (!/^\d*$/.test(afterExcp)) return; // only digits after EXCP
                    if (afterExcp.length > 6) return; // max 6 digits
                  }

                  setOpeId("OPE-" + suffix);

                  // ✅ Live validation for user feedback
                  if (
                    /^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix)
                  ) {
                    setErrors((prev) => {
                      const { opeId: _ignored, ...rest } = prev;
                      return rest;
                    });
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      opeId:
                        "OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456",
                    }));
                  }
                }}
                onBlur={() => {
                  const suffix = opeId.slice(4);
                  if (!/^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix)) {
                    setErrors((prev) => ({
                      ...prev,
                      opeId:
                        "OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456",
                    }));
                  } else {
                    setErrors((prev) => {
                      const { opeId: _ignored, ...rest } = prev;
                      return rest;
                    });
                    checkOpeUnique();
                  }
                }}
                placeholder="OPE-1234567890 or OPE-HOLD123456 or OPE-EXCP123456"
              />

            {errors.opeId && (
              <Text color="status-critical" size="small">
                {errors.opeId}
              </Text>
            )}

            <Text>Customer Number</Text>
            <TextInput
              value={customerNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCustomerNo(val);
              }}
              onBlur={fetchCustomerDetails}
              placeholder="Enter Customer Number"
            />
            {customerName && (
              <Text color="brand" size="small">
                {customerName}
              </Text>
            )}
            {errors.customerNo && (
              <Text color="status-critical" size="small">
                {errors.customerNo}
              </Text>
            )}

            <Text>Quote ID</Text>
            <TextInput
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
              placeholder="Enter Quote ID (optional)"
            />

            {/* Partner checkbox */}
            <Box direction="row" align="center" gap="small" margin={{ top: "small" }}>
              <CheckBox
                label="Contracting party"
                checked={isPartnerLed}
                onChange={(e) => setIsPartnerLed(e.target.checked)}
              />
            </Box>

            {/* Partner input */}
            {isPartnerLed && (
              <Box gap="small" margin={{ top: "small" }}>
                {/* <Text>Partner Name</Text> */}
                <TextInput
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Enter Partner Name"
                />
                {errors.partnerName && <Text color="status-critical">{errors.partnerName}</Text>}
              </Box>
            )}
          </Box>

          {/* Right Column - Engagement Resources */}
          {/* <Box gap="small">
            <Text>Engagement Resources</Text>
            {errors.engagementResources && (
              <Text color="status-critical" size="small">
                {errors.engagementResources}
              </Text>
            )}

            {engagementResources.map((resource, idx) => (
              <React.Fragment key={idx}>
                <EngagementResourceRow
                  idx={idx}
                  resource={resource}
                  updateResource={(i, updated) => {
                    const updatedResources = [...engagementResources];
                    updatedResources[i] = updated;
                    setEngagementResources(updatedResources);
                  }}
                  removeResource={(i) => {
                    setEngagementResources((prev) => prev.filter((_, j) => j !== i));
                  }}
                />
                {errors[`resource-${idx}`] && (
                  <Text color="status-critical" size="small">
                    {errors[`resource-${idx}`]}
                  </Text>
                )}
              </React.Fragment>
            ))}

          <Button
            label="+ Add Resource"
            hoverIndicator={false}
            style={{
              border: "2px solid green",
              color: "green",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = "2px solid #008000"; // same green on hover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = "2px solid green";
            }}
            onClick={() =>
              setEngagementResources((prev) => [...prev, { role: "", name: "" }])
            }
          />
          </Box> */}
        </Grid>

        {/* Action Buttons */}
        <Box direction="row" gap="small" justify="end" margin={{ top: "medium" }} flex={false}>
          <Button
            label={checkingOpe ? "Checking..." : submitting ? "Saving..." : "Build SOW"}
            primary
            style={{ backgroundColor: (!isOpeUnique || submitting) ? "gray" : "#004f2d", color: "white", border : "none" }}
            onClick={handleCreateSOW}
            disabled={checkingOpe || !isOpeUnique || submitting}
          />
          <Button style={{border:'2px solid green'}} label="Cancel" onClick={onClose} />
        </Box>
      </Box>
    </Layer>
  );
}