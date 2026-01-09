"use client";

import { useState } from "react";
import {
  PlanningOrder,
  ProcessConfig,
  ProcessRunConfig,
} from "@/types/planning";
import { isProcessConfigured } from "@/utils/processCompletion";
import CreateOrderModal from "@/components/modals/CreateOrderModal";

// ================= SAMPLE DATA =================
import planningData from "@/data/samplePlanning.json";
// ==============================================

export default function PlanningPage() {
  // ================= SAMPLE DATA =================
  const [orders, setOrders] = useState<PlanningOrder[]>(
    planningData.orders as PlanningOrder[]
  );
  // ==============================================

  const [openCreate, setOpenCreate] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [selectedProcess, setSelectedProcess] = useState<ProcessConfig | null>(
    null
  );
  const [selectedRun, setSelectedRun] =
    useState<ProcessRunConfig | null>(null);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  /* =================================================
     SAMPLE DATA – UPDATE RUN FIELD
     ================================================= */

  const updateRunField = (
    processName: string,
    runNumber: number,
    field: string,
    value: string | number
  ) => {
    if (!selectedOrderId) return;

    setOrders(prev =>
      prev.map(order =>
        order.id !== selectedOrderId
          ? order
          : {
              ...order,
              processes: order.processes.map(process =>
                process.processName !== processName
                  ? process
                  : {
                      ...process,
                      runs: process.runs.map(run =>
                        run.runNumber !== runNumber
                          ? run
                          : {
                              ...run,
                              fields: {
                                ...run.fields,
                                [field]: value,
                              },
                            }
                      ),
                    }
              ),
            }
      )
    );
  };

  /* =================================================
     SAMPLE DATA – CREATE ORDER
     ================================================= */

  const handleCreateOrder = (payload: {
    customerName: string;
    customerCode: string;
    quantity: number;
    processes: ProcessConfig[];
  }) => {
    const newOrder: PlanningOrder = {
      id: crypto.randomUUID(),
      orderNumber: `ORDER-${orders.length + 1}`,
      customerName: payload.customerName,
      quantity: payload.quantity,
      productionReady: false,
      createdAt: new Date().toISOString(),
      processes: payload.processes, // ✅ FIXED
    };

    setOrders(prev => [...prev, newOrder]);
    setSelectedOrderId(newOrder.id);
    setSelectedProcess(null);
    setSelectedRun(null);
  };

  /* ================================================= */

  return (
    <div className="flex h-full">

      {/* LEFT PANEL */}
      <aside className="w-72 border-r bg-gray-50">
        <div className="p-3 font-semibold text-sm flex justify-between">
          Orders
          <button
            onClick={() => setOpenCreate(true)}
            className="text-blue-600 text-xs"
          >
            + New
          </button>
        </div>

        {orders.map(order => (
          <div
            key={order.id}
            onClick={() => {
              setSelectedOrderId(order.id);
              setSelectedProcess(null);
              setSelectedRun(null);
            }}
            className="p-3 border-b cursor-pointer hover:bg-gray-100"
          >
            <div className="font-medium">{order.orderNumber}</div>
            <div className="text-xs text-gray-500">
              {order.customerName}
            </div>
          </div>
        ))}
      </aside>

      {/* MAIN */}
      <div className="flex-1 p-6">
        {!selectedOrder && (
          <div className="text-gray-500">
            Select or create an order
          </div>
        )}

        {selectedOrder && (
          <div className="flex gap-6">

            {/* PROCESS LIST */}
            <div className="w-64 border rounded-md p-3">
              <div className="font-semibold text-sm mb-2">
                Processes
              </div>

              {selectedOrder.processes.map(process => (
                <div key={process.processName}>
                  <div
                    onClick={() => {
                      setSelectedProcess(process);
                      setSelectedRun(null);
                    }}
                    className="flex justify-between cursor-pointer p-2 hover:bg-gray-100"
                  >
                    <span>{process.processName}</span>
                    <span>
                      {isProcessConfigured(process) ? "✅" : "❌"}
                    </span>
                  </div>

                  {/* RUN LIST */}
                  {selectedProcess?.processName ===
                    process.processName &&
                    process.runs.map(run => (
                      <div
                        key={run.runNumber}
                        onClick={() => setSelectedRun(run)}
                        className="ml-4 text-sm cursor-pointer hover:underline"
                      >
                        Run {run.runNumber}
                      </div>
                    ))}
                </div>
              ))}
            </div>

            {/* RUN EDITOR */}
            <div className="flex-1 border rounded-md p-4">
              {!selectedRun && (
                <div className="text-gray-500">
                  Select a run to configure
                </div>
              )}

              {selectedRun && selectedProcess && (
                <>
                  <h3 className="font-semibold mb-4">
                    {selectedProcess.processName} – Run{" "}
                    {selectedRun.runNumber}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(selectedRun.fields).map(field => (
                      <input
                        key={field}
                        placeholder={field}
                        value={selectedRun.fields[field] ?? ""}
                        onChange={e =>
                          updateRunField(
                            selectedProcess.processName,
                            selectedRun.runNumber,
                            field,
                            e.target.value
                          )
                        }
                        className="border rounded px-2 py-1"
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE ORDER MODAL */}
      <CreateOrderModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreateOrder} // SAMPLE DATA
      />
    </div>
  );
}
