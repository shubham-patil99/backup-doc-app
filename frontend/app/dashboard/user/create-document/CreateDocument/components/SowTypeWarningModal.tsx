import React from 'react';

interface SowTypeWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fromType: 'full' | 'small' | 'proposal';
  toType: 'full' | 'small' | 'proposal';
}

export default function SowTypeWarningModal({
  isOpen,
  onConfirm,
  onCancel,
  fromType,
  toType
}: SowTypeWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-lg font-bold mb-4 text-gray-900">
          Change SoW Type?
        </h3>
        <p className="mb-4 text-gray-600">
          Switching from <span className="font-semibold">{fromType === 'full' ? 'Full SoW' : fromType === 'proposal' ? 'Proposal' : 'Short SoW'}</span> to{' '}
          <span className="font-semibold">{toType === 'full' ? 'Full SoW' : toType === 'proposal' ? 'Proposal' : 'Short SoW'}</span> will reset your document builder and save the current state.
        </p>
        <p className="mb-6 text-sm text-amber-600 font-medium">
          ⚠️ All sections and modules in the document builder will be cleared.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}