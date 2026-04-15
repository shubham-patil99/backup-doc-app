// @ts-nocheck
"use client";

import React from "react";

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  opeId: string;
  version: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  opeId, version, isDeleting, onConfirm, onCancel,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4 text-red-600">Delete Document</h3>
        <p className="mb-2 text-gray-700">
          <strong>Warning:</strong> Deleting this document cannot be undone.
        </p>
        <p className="mb-4 text-gray-700">
          This will permanently remove all versions ({version || 1} version(s)) for OPE ID:{" "}
          <strong>{opeId}</strong>.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
          </button>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Confirm Modal ───────────────────────────────────────────────────────

interface ResetConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetConfirmModal({ onConfirm, onCancel }: ResetConfirmModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4">Reset Document</h3>
        <p className="mb-4">
          Are you sure? This will remove all sections and modules from your document.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Yes, Reset
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
      {message}
    </div>
  );
}