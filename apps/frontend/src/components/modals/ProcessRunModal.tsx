'use client';

import { useState } from 'react';
import { ProcessRun } from '@/types/domain';

//interface Props {
//  run: ProcessRun | null;
//  onClose: () => void;

//  // SAMPLE DATA – replace with API later
//  onAssign: (
//    runId: string,
//    managerName: string,
//    location: string
//  ) => void;

//  // SAMPLE DATA – replace with API later
//  onStart: (runId: string) => void;

//  // SAMPLE DATA – replace with API later
//  onHalt: (runId: string) => void;
//}

//export default function ProcessRunModal({
//  run,
//  onClose,
//  onAssign,
//  onStart,
//  onHalt,
//}: Props) {
//  if (!run) return null;

//  // SAMPLE DATA – local UI state
//  const [manager, setManager] = useState("");
//  const [location, setLocation] = useState("");
//  const [showReassign, setShowReassign] = useState(false);

//  return (
//    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
//      <div className="w-full max-w-2xl rounded-lg bg-white p-6">
//        {/* Header */}
//        <div className="flex justify-between items-center mb-4">
//          <h2 className="text-lg font-semibold">
//            {run.processName} – Run {run.runNumber}
//          </h2>
//          <button
//            onClick={onClose}
//            className="text-gray-500 hover:text-black"
//          >
//            ✕
//          </button>
//        </div>

//        {/* Section 1 – Process Details */}
//        <div className="grid grid-cols-2 gap-4 border rounded-md p-4 mb-6 text-sm">
//          <Detail label="Print Type" value={run.details.printType} />
//          <Detail label="Fabric Color" value={run.details.fabricColor} />
//          <Detail label="No. of Colors" value={run.details.colors.toString()} />
//          <Detail label="Quantity" value={run.details.quantity.toString()} />
//        </div>

//        {/* Section 2 – Assignment & Actions */}
//        <div className="border rounded-md p-4 text-sm space-y-4">

//          {/* ================= TODO ================= */}
//          {run.status === "TODO" && (
//            <AssignForm
//              manager={manager}
//              location={location}
//              setManager={setManager}
//              setLocation={setLocation}
//              submitLabel="Assign"
//              onSubmit={() => {
//                onAssign(run.id, manager, location); // SAMPLE DATA
//                onClose();
//              }}
//            />
//          )}

//          {/* ================= ASSIGNED ================= */}
//          {run.status === "ASSIGNED" && (
//            <>
//              <AssignedInfo run={run} />

//              <div className="flex gap-3">
//                <button
//                  onClick={() => {
//                    onStart(run.id); // SAMPLE DATA
//                    onClose();
//                  }}
//                  className="px-4 py-2 bg-green-600 text-white rounded"
//                >
//                  Start Process
//                </button>

//                <button
//                  onClick={() => setShowReassign(true)}
//                  className="px-4 py-2 border rounded"
//                >
//                  Reassign
//                </button>
//              </div>

//              {showReassign && (
//                <AssignForm
//                  manager={manager}
//                  location={location}
//                  setManager={setManager}
//                  setLocation={setLocation}
//                  submitLabel="Reassign"
//                  onSubmit={() => {
//                    onAssign(run.id, manager, location); // SAMPLE DATA
//                    onClose();
//                  }}
//                />
//              )}
//            </>
//          )}

//          {/* ================= IN_PROGRESS ================= */}
//          {run.status === "IN_PROGRESS" && (
//            <>
//              <AssignedInfo run={run} />

//              <button
//                onClick={() => {
//                  onHalt(run.id); // SAMPLE DATA
//                  onClose();
//                }}
//                className="px-4 py-2 bg-orange-600 text-white rounded"
//              >
//                Halt Process
//              </button>
//            </>
//          )}

//          {/* ================= HALTED ================= */}
//          {run.status === "HALTED" && (
//            <>
//              <AssignedInfo run={run} />

//              <div className="flex gap-3">
//                <button
//                  onClick={() => {
//                    onStart(run.id); // SAMPLE DATA
//                    onClose();
//                  }}
//                  className="px-4 py-2 bg-green-600 text-white rounded"
//                >
//                  Resume
//                </button>

//                <button
//                  onClick={() => setShowReassign(true)}
//                  className="px-4 py-2 border rounded"
//                >
//                  Reassign
//                </button>
//              </div>

//              {showReassign && (
//                <AssignForm
//                  manager={manager}
//                  location={location}
//                  setManager={setManager}
//                  setLocation={setLocation}
//                  submitLabel="Reassign"
//                  onSubmit={() => {
//                    onAssign(run.id, manager, location); // SAMPLE DATA
//                    onClose();
//                  }}
//                />
//              )}
//            </>
//          )}

//          {/* ================= COMPLETED ================= */}
//          {run.status === "COMPLETED" && (
//            <AssignedInfo run={run} />
//          )}

//        </div>
//      </div>
//    </div>
//  );
//}

///* ================= HELPERS ================= */

//function Detail({ label, value }: { label: string; value: string }) {
//  return (
//    <div>
//      <div className="text-xs text-gray-500">{label}</div>
//      <div className="font-medium">{value}</div>
//    </div>
//  );
//}

//function AssignedInfo({ run }: { run: ProcessRun }) {
//  if (!run.assignedManager) return null;

//  return (
//    <div className="space-y-1">
//      <Detail label="Manager" value={run.assignedManager.name} />
//      <Detail label="Location" value={run.assignedManager.location} />
//      <Detail
//        label="Assigned At"
//        value={new Date(run.assignedManager.assignedAt).toLocaleString()}
//      />
//    </div>
//  );
//}

//// SAMPLE DATA – reusable assign / reassign form
//function AssignForm({
//  manager,
//  location,
//  setManager,
//  setLocation,
//  onSubmit,
//  submitLabel,
//}: {
//  manager: string;
//  location: string;
//  setManager: (v: string) => void;
//  setLocation: (v: string) => void;
//  onSubmit: () => void;
//  submitLabel: string;
//}) {
//  // SAMPLE DATA – replace with real users later
//  const managers = [
//    { name: "Rohit Sharma", location: "Printing Unit A" },
//    { name: "Amit Verma", location: "Unit B" },
//    { name: "Neha Singh", location: "Main Unit" },
//  ];

//  return (
//    <div className="space-y-3">
//      <select
//        value={manager}
//        onChange={e => {
//          const m = managers.find(x => x.name === e.target.value);
//          setManager(e.target.value);
//          setLocation(m?.location || "");
//        }}
//        className="w-full border rounded px-2 py-1"
//      >
//        <option value="">Select Manager</option>
//        {managers.map(m => (
//          <option key={m.name} value={m.name}>
//            {m.name}
//          </option>
//        ))}
//      </select>

//      <input
//        value={location}
//        readOnly
//        placeholder="Location"
//        className="w-full border rounded px-2 py-1 bg-gray-50"
//      />

//      <button
//        disabled={!manager}
//        onClick={onSubmit}
//        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
//      >
//        {submitLabel}
//      </button>
//    </div>
//  );
//}
