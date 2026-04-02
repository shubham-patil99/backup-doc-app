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
        <p className="mb-4 text-gray-700">
          Switching from <span className="font-semibold">{fromType === 'full' ? 'Full SoW' : fromType === 'proposal' ? 'Proposal' : 'Short SoW'}</span> to{' '}
          <span className="font-semibold">{toType === 'full' ? 'Full SoW' : toType === 'proposal' ? 'Proposal' : 'Short SoW'}</span> will:
        </p>
        <ul className="mb-6 text-sm text-gray-700 space-y-2 ml-4">
          <li>✓ Delete <strong>all saved versions</strong> (drafts and finals) for the current {fromType === 'full' ? 'Full SoW' : fromType === 'proposal' ? 'Proposal' : 'Short SoW'} from the database</li>
          <li>✓ Clear the document builder completely</li>
          <li>✓ Start fresh with a blank {toType === 'full' ? 'Full SoW' : toType === 'proposal' ? 'Proposal' : 'Short SoW'}</li>
        </ul>
        <p className="mb-6 text-sm text-red-600 font-semibold">
          ⚠️ This action cannot be undone. All {fromType === 'full' ? 'Full SoW' : fromType === 'proposal' ? 'Proposal' : 'Short SoW'} records for this OPE will be permanently deleted.
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
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Yes, Delete & Switch
          </button>
        </div>
      </div>
    </div>
  );
}