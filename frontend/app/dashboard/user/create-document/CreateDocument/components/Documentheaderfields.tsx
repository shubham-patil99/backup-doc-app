// @ts-nocheck
"use client";

import React from "react";
import { Pencil, X } from "lucide-react";

interface DocumentHeaderFieldsProps {
  // Document Name
  documentName: string;
  setDocumentName: (v: string) => void;
  documentNameFocused: boolean;
  setDocumentNameFocused: (v: boolean) => void;
  isSavingDocumentName: boolean;
  onSaveDocumentName: () => void;

  // Customer No
  customerNo: string;
  setCustomerNo: (v: string) => void;
  customerName: string;
  errors: any;
  customerNoFocused: boolean;
  setCustomerNoFocused: (v: boolean) => void;
  isSavingCustomerNo: boolean;
  onSaveCustomerNo: () => void;
  fetchCustomerDetails: () => void;

  // Contracting Party
  contractingParty: string;
  setContractingParty: (v: string) => void;
  contractingPartyFocused: boolean;
  setContractingPartyFocused: (v: boolean) => void;
  isSavingContractingParty: boolean;
  onSaveContractingParty: () => void;

  // Quote ID
  quoteId: string | null;
  setQuoteId: (v: string) => void;
  quoteIdFocused: boolean;
  setQuoteIdFocused: (v: boolean) => void;
  isSavingQuoteId: boolean;
  onSaveQuoteId: () => void;

  // OPE ID
  opeId: string;
  newOpeId: string;
  setNewOpeId: (v: string) => void;
  isEditingOpeId: boolean;
  setIsEditingOpeId: (v: boolean) => void;
  isSaving: boolean;
  isChangingOpeId: boolean;
  errors: any;
  setErrors: (fn: any) => void;
  onConfirmOpeIdChange: () => void;
}

export default function DocumentHeaderFields({
  documentName, setDocumentName,
  documentNameFocused, setDocumentNameFocused,
  isSavingDocumentName, onSaveDocumentName,
  customerNo, setCustomerNo, customerName, errors,
  customerNoFocused, setCustomerNoFocused,
  isSavingCustomerNo, onSaveCustomerNo, fetchCustomerDetails,
  contractingParty, setContractingParty,
  contractingPartyFocused, setContractingPartyFocused,
  isSavingContractingParty, onSaveContractingParty,
  quoteId, setQuoteId,
  quoteIdFocused, setQuoteIdFocused,
  isSavingQuoteId, onSaveQuoteId,
  opeId, newOpeId, setNewOpeId,
  isEditingOpeId, setIsEditingOpeId,
  isSaving, isChangingOpeId, setErrors,
  onConfirmOpeIdChange,
}: DocumentHeaderFieldsProps) {
  return (
    <div className="mb-3 p-3 bg-white rounded-xl shadow-sm">
      {/* Row 1: Document Name + Customer */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
        {/* Document Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              onFocus={() => setDocumentNameFocused(true)}
              onBlur={() => !isSavingDocumentName && setDocumentNameFocused(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {documentNameFocused && (
              <button
                onMouseDown={onSaveDocumentName}
                disabled={isSavingDocumentName}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
              >
                {isSavingDocumentName ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* Customer No */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span>Customer</span>
            <span className={`ml-2 text-xm font-small ${errors?.customerNo ? "text-red-600" : "text-green-700"}`}>
              {errors?.customerNo || customerName || ""}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerNo}
              onChange={(e) => setCustomerNo(e.target.value.replace(/\D/g, ""))}
              onFocus={() => setCustomerNoFocused(true)}
              onBlur={async () => {
                if (!isSavingCustomerNo) {
                  await fetchCustomerDetails();
                  setCustomerNoFocused(false);
                }
              }}
              placeholder="Customer Number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {customerNoFocused && (
              <button
                onMouseDown={onSaveCustomerNo}
                disabled={isSavingCustomerNo}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 flex-shrink-0"
              >
                {isSavingCustomerNo ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Contracting Party + Quote ID + OPE ID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contracting Party */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Contracting Party</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={contractingParty}
              placeholder="Enter Contracting Party"
              onChange={(e) => setContractingParty(e.target.value)}
              onFocus={() => setContractingPartyFocused(true)}
              onBlur={() => !isSavingContractingParty && setContractingPartyFocused(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {contractingPartyFocused && (
              <button
                onMouseDown={onSaveContractingParty}
                disabled={isSavingContractingParty}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
              >
                {isSavingContractingParty ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* Quote ID */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Quote ID</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={quoteId || ""}
              placeholder="Enter Quote Id"
              onChange={(e) => setQuoteId(e.target.value)}
              onFocus={() => setQuoteIdFocused(true)}
              onBlur={() => !isSavingQuoteId && setQuoteIdFocused(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {quoteIdFocused && (
              <button
                onMouseDown={onSaveQuoteId}
                disabled={isSavingQuoteId}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
              >
                {isSavingQuoteId ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* OPE ID */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">OPE ID</label>
          <div className="flex items-center gap-2">
            {isEditingOpeId ? (
              <>
                <input
                  type="text"
                  value={newOpeId}
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase();
                    if (!val.startsWith("OPE-")) val = "OPE-" + val.replace(/^OPE-?/i, "");
                    const suffix = val.slice(4);
                    if (!/^[A-Z0-9]*$/.test(suffix)) return;
                    if (/^\d+$/.test(suffix) && suffix.length > 10) return;
                    if (suffix.startsWith("HOLD") && (!/^\d*$/.test(suffix.slice(4)) || suffix.slice(4).length > 6)) return;
                    if (suffix.startsWith("EXCP") && (!/^\d*$/.test(suffix.slice(4)) || suffix.slice(4).length > 6)) return;
                    setNewOpeId("OPE-" + suffix);
                    if (/^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix))
                      setErrors((prev: any) => { const { opeId: _, ...rest } = prev; return rest; });
                    else
                      setErrors((prev: any) => ({ ...prev, opeId: "OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456" }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={onConfirmOpeIdChange}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingOpeId(false)}
                  className="cursor-pointer hover:bg-gray-200 rounded-lg p-1"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </>
            ) : (
              <div className="px-4 py-2 bg-gray-50 border rounded-lg font-mono text-sm flex items-center justify-between w-full">
                <span>{opeId}</span>
                <button
                  onClick={() => setIsEditingOpeId(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Edit OPE ID"
                  disabled={isSaving || isChangingOpeId}
                >
                  <Pencil className="h-4 w-4 text-blue-500" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}