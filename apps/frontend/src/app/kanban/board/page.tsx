"use client";

import { useState } from "react";
import OrdersSidebar from "@/components/board/OrdersSidebar";
import KanbanBoard from "@/components/board/KanbanBoard";
import ProcessRunModal from "@/components/modals/ProcessRunModal";
import { Order, ProcessRun } from "@/types/domain";

// ================= SAMPLE DATA =================
// REMOVE ALL SAMPLE DATA WHEN CONNECTING REAL API
import sampleData from "@/data/sampleData.json";

export default function BoardPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [selectedRun, setSelectedRun] = useState<ProcessRun | null>(null);

  // ================= SAMPLE DATA =================
  // Orders loaded from local JSON
  const orders = sampleData.orders as Order[];

  // Process runs kept in state (mutable for demo)
  const [runs, setRuns] = useState<ProcessRun[]>(
    sampleData.processRuns as ProcessRun[]
  );
  // ================= END SAMPLE DATA =================

  // Filter runs by selected order
  const filteredRuns = selectedOrderId
    ? runs.filter(run => run.orderId === selectedOrderId)
    : runs;

  /* =================================================
     SAMPLE DATA – STATE TRANSITION HANDLERS
     REPLACE THESE WITH API CALLS LATER
     ================================================= */

  // Assign or Reassign → ASSIGNED
  const assignManager = (
    runId: string,
    managerName: string,
    location: string
  ) => {
    setRuns(prev =>
      prev.map(run =>
        run.id === runId
          ? {
              ...run,
              status: "ASSIGNED",
              assignedManager: {
                name: managerName,
                location,
                assignedAt: new Date().toISOString(),
              },
            }
          : run
      )
    );
  };

  // Start or Resume → IN_PROGRESS
  const startProcess = (runId: string) => {
    setRuns(prev =>
      prev.map(run =>
        run.id === runId
          ? { ...run, status: "IN_PROGRESS" }
          : run
      )
    );
  };

  // Halt → HALTED
  const haltProcess = (runId: string) => {
    setRuns(prev =>
      prev.map(run =>
        run.id === runId
          ? { ...run, status: "HALTED" }
          : run
      )
    );
  };

  /* ================================================= */

  return (
    <div className="flex h-full">
      {/* LEFT: Orders */}
      <OrdersSidebar
        orders={orders}
        selectedOrderId={selectedOrderId}
        onSelect={setSelectedOrderId}
      />

      {/* MAIN: Kanban Board */}
      <KanbanBoard
        runs={filteredRuns}
        onSelectRun={setSelectedRun}
      />

      {/* MODAL */}
      <ProcessRunModal
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
        onAssign={assignManager}   // SAMPLE DATA
        onStart={startProcess}     // SAMPLE DATA
        onHalt={haltProcess}       // SAMPLE DATA
      />
    </div>
  );
}
