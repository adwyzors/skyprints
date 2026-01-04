"use client";

import { ProcessRun } from "@/types/domain";

interface Props {
  run: ProcessRun | null;
  onClose: () => void;
}

export default function ProcessRunModal({ run, onClose }: Props) {
  if (!run) return null;

  const assigned = run.assignedManager;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {run.processName} – Run {run.runNumber}
          </h2>
          <button onClick={onClose} className="text-sm text-gray-500">
            ✕
          </button>
        </div>

        {/* Section 1 – Process Details (like your screenshot) */}
        <div className="grid grid-cols-2 gap-4 border rounded-md p-4 mb-6 text-sm">
          <Detail label="Print Type" value={run.details.printType} />
          <Detail label="Fabric Color" value={run.details.fabricColor} />
          <Detail label="No. of Colors" value={run.details.colors.toString()} />
          <Detail label="Quantity" value={run.details.quantity.toString()} />
        </div>

        {/* Section 2 – Assignment */}
        <div className="border rounded-md p-4 text-sm">
          {assigned ? (
            <>
              <Detail label="Manager" value={assigned.name} />
              <Detail label="Location" value={assigned.location} />
              <Detail
                label="Assigned At"
                value={new Date(assigned.assignedAt).toLocaleString()}
              />
            </>
          ) : (
            <div className="text-gray-500">
              No manager assigned
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
