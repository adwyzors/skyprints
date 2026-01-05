// src/app/dashboard/board/page.tsx
"use client";

import { useState } from "react";
import { withAuth } from "@/auth/withAuth";
import { Permission } from "@/auth/permissions";

import AppHeader from "@/components/layout/AppHeader";
import BoardTabs, { BoardTab } from "@/components/board/BoardTabs";
import OrdersSidebar from "@/components/board/OrdersSidebar";
import KanbanBoard from "@/components/board/KanbanBoard";
import ProcessRunModal from "@/components/modals/ProcessRunModal";
import { Order, ProcessRun } from "@/types/domain";

function BoardPage() {
  const [activeTab, setActiveTab] = useState<BoardTab>("BOARD");
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [selectedRun, setSelectedRun] = useState<ProcessRun | null>(null);

  const orders: Order[] = [];
  const runs: ProcessRun[] = [];

  const filteredRuns = selectedOrderId
    ? runs.filter(r => r.orderId === selectedOrderId)
    : runs;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader />
      <BoardTabs active={activeTab} onChange={setActiveTab} />

      <div className="flex flex-1 overflow-hidden">
        {activeTab === "BOARD" && (
          <>
            <OrdersSidebar
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelect={setSelectedOrderId}
            />
            <KanbanBoard runs={filteredRuns} onSelectRun={setSelectedRun} />
          </>
        )}

        {activeTab === "BILLING" && (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Billing — Coming Soon
          </div>
        )}

        {activeTab === "COMPLETED" && (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Completed Orders — Coming Soon
          </div>
        )}
      </div>

      <ProcessRunModal
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}

export default withAuth(BoardPage, {
  permission: Permission.VIEW_BOARD,
});