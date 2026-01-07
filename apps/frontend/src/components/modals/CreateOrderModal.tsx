"use client";

import { useMemo, useState } from "react";
import customersData from "@/data/customers.json";
import processesData from "@/data/processes.json";
import { NewOrderPayload } from "@/types/planning";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: NewOrderPayload) => void;
}

interface ProcessRow {
  processId: string;
  runs: number;
}

export default function CreateOrderModal({
  open,
  onClose,
  onCreate,
}: Props) {
  if (!open) return null;

  /* ================= ORDER STATE ================= */

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [quantity, setQuantity] = useState<number>(0);

  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);

  /* ================= DERIVED ================= */

  const customers = customersData.customers;
  const processes = processesData.processes;

  const filteredCustomers = useMemo(
    () =>
      customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(customerSearch.toLowerCase())
      ),
    [customerSearch, customers]
  );

  const selectedCustomer = customers.find(
    c => c.id === selectedCustomerId
  );

  /* ================= PROCESS ROWS ================= */

  const addProcessRow = () => {
    setProcessRows(prev => [
      ...prev,
      { processId: "", runs: 1 },
    ]);
  };

  const updateProcessRow = (
    index: number,
    patch: Partial<ProcessRow>
  ) => {
    setProcessRows(prev =>
      prev.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      )
    );
  };

  const removeProcessRow = (index: number) => {
    setProcessRows(prev => prev.filter((_, i) => i !== index));
  };

  /* ================= CREATE ================= */

  const handleCreate = () => {
    if (!selectedCustomer) return;

    const payload: NewOrderPayload = {
      customerName: selectedCustomer.name,
      customerCode: selectedCustomer.code,
      quantity,

      processes: processRows.map(row => {
        const process = processes.find(p => p.id === row.processId)!;

        return {
          processName: process.name,
          runs: Array.from({ length: row.runs }).map((_, i) => ({
            runNumber: i + 1,
            fields: {},
          })),
        };
      }),
    };

    onCreate(payload);
    onClose();
  };

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-3xl rounded-lg p-6 max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Create Order</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* ORDER INFO */}
        <div className="grid grid-cols-2 gap-4 mb-6">

          {/* CUSTOMER SEARCH */}
          <div className="relative">
            <input
              placeholder="Customer name or code"
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setSelectedCustomerId(null);
              }}
              className="border rounded px-2 py-1 w-full"
            />

            {customerSearch && !selectedCustomer && (
              <div className="absolute z-10 bg-white border w-full max-h-40 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearch(c.name);
                    }}
                    className="px-2 py-1 cursor-pointer hover:bg-gray-100"
                  >
                    {c.name} ({c.code})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CUSTOMER CODE */}
          <input
            placeholder="Customer Code"
            value={selectedCustomer?.code ?? ""}
            readOnly
            className="border rounded px-2 py-1 bg-gray-50"
          />

          {/* QUANTITY */}
          <input
            type="number"
            placeholder="Quantity"
            value={quantity || ""}
            onChange={e => setQuantity(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />

          {/* ORDER ID (AUTO) */}
          <input
            placeholder="Order ID (auto)"
            value="Auto Generated"
            readOnly
            className="border rounded px-2 py-1 bg-gray-50"
          />
        </div>

        {/* PROCESSES */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Processes</div>

          {processRows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-2 mb-2 items-center"
            >
              <select
                value={row.processId}
                onChange={e =>
                  updateProcessRow(i, { processId: e.target.value })
                }
                className="border rounded px-2 py-1 col-span-2"
              >
                <option value="">Select process</option>
                {processes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={row.runs}
                onChange={e =>
                  updateProcessRow(i, { runs: Number(e.target.value) })
                }
                className="border rounded px-2 py-1"
              />

              <button
                onClick={() => removeProcessRow(i)}
                className="text-red-500"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={addProcessRow}
            className="text-blue-600 text-sm mt-2"
          >
            + Add process
          </button>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="border px-4 py-2 rounded">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}
