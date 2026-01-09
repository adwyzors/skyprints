// @/services/orders.service.ts

import ordersData from "@/data/orders.json";
import customersData from "@/data/customers.json";
import processesData from "@/data/processes.json";

import { Order, ProcessRun } from "@/types/domain";
import { NewOrderPayload } from "@/types/planning";

/**
 * INTERNAL IN-MEMORY STORE
 * -------------------------------------------------
 * Mimics backend storage.
 */
let ORDERS_STORE: Order[] = ordersData.orders as Order[];

/* =================================================
   READ
   ================================================= */

export function getOrders(): Order[] {
  return [...ORDERS_STORE];
}

export function getOrderById(orderId: string): Order | undefined {
  return ORDERS_STORE.find(o => o.id === orderId);
}

/* =================================================
   CREATE
   ================================================= */

export function createOrder(payload: NewOrderPayload): Order {
  const customer = customersData.customers.find(
    c =>
      c.name === payload.customerName ||
      c.code === payload.customerCode
  );
  if (!customer) throw new Error("Customer not found");

  const newOrder: Order = {
    id: crypto.randomUUID(),
    orderCode: `ORDER-${ORDERS_STORE.length + 1}`,
    customerId: customer.id,
    customerName: customer.name,
    customerCode: customer.code,
    quantity: payload.quantity,

    // ✅ ORDER LIFECYCLE
    status: "CONFIGURE",

    createdAt: new Date().toISOString(),

    processes: payload.processes.map(p => {
      const processDef = processesData.processes.find(
        x => x.name === p.processName
      );
      if (!processDef) throw new Error("Process not found");

      return {
        id: crypto.randomUUID(),
        name: processDef.name,
        quantity: payload.quantity,

        runs: Array.from({ length: typeof p.runs === 'number' ? p.runs : p.runs.length }).map(
          (_, index) => ({
            id: crypto.randomUUID(),
            runNumber: index + 1,

            // ✅ RUN STARTS UNCONFIGURED
            status: "NOT_CONFIGURED",

            // ✅ PRE-CREATE ALL FIELDS AS NULL
            fields: Object.fromEntries(
              Object.keys(processDef.fields).map(
                f => [f, null]
              )
            ),
            
            // ✅ ADD LOCATION FIELD (initially empty)
            location: "",
          })
        ),
      };
    }),
  };

  ORDERS_STORE.push(newOrder);
  return newOrder;
}

/* =================================================
   UPDATE
   ================================================= */

export function updateOrder(updated: Order): void {
  ORDERS_STORE = ORDERS_STORE.map(o =>
    o.id === updated.id ? updated : o
  );
}

/* =================================================
   RUN MANAGEMENT - PARALLEL EXECUTION
   ================================================= */

/**
 * Update run status (parallel execution - runs can be updated independently)
 */
export function updateRunStatus(
  orderId: string, 
  processId: string, 
  runId: string, 
  newStatus: string
): Order | undefined {
  const orderIndex = ORDERS_STORE.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return undefined;

  const order = { ...ORDERS_STORE[orderIndex] };
  
  // Find and update the specific run
  const process = order.processes.find(p => p.id === processId);
  if (!process) return undefined;

  const runIndex = process.runs.findIndex(r => r.id === runId);
  if (runIndex === -1) return undefined;

  // Update the run status (no dependency check for parallel execution)
  process.runs[runIndex].status = newStatus;

  // Check if all runs in all processes are completed
  const allRunsCompleted = order.processes.every(p =>
    p.runs.every(r => r.status === "COMPLETED")
  );

  // Update order status based on run statuses
  if (allRunsCompleted) {
    order.status = "COMPLETED";
  } else if (order.status === "CONFIGURE") {
    // If order was in CONFIGURE and any run is now configured or beyond
    const hasActiveRuns = order.processes.some(p =>
      p.runs.some(r => r.status !== "NOT_CONFIGURED" && r.status !== "CONFIGURED")
    );
    
    if (hasActiveRuns) {
      order.status = "IN_PRODUCTION";
    }
  }

  ORDERS_STORE[orderIndex] = order;
  return order;
}

/**
 * Update run location
 */
export function updateRunLocation(
  orderId: string, 
  processId: string, 
  runId: string, 
  location: string
): Order | undefined {
  const orderIndex = ORDERS_STORE.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return undefined;

  const order = { ...ORDERS_STORE[orderIndex] };
  
  const process = order.processes.find(p => p.id === processId);
  if (!process) return undefined;

  const run = process.runs.find(r => r.id === runId);
  if (!run) return undefined;

  run.location = location;

  ORDERS_STORE[orderIndex] = order;
  return order;
}

/**
 * Configure a run (move from NOT_CONFIGURED to CONFIGURED)
 */
export function configureRun(
  orderId: string, 
  processId: string, 
  runId: string,
  configuration: Record<string, any>
): Order | undefined {
  const orderIndex = ORDERS_STORE.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return undefined;

  const order = { ...ORDERS_STORE[orderIndex] };
  
  const process = order.processes.find(p => p.id === processId);
  if (!process) return undefined;

  const runIndex = process.runs.findIndex(r => r.id === runId);
  if (runIndex === -1) return undefined;

  // Update run configuration
  process.runs[runIndex] = {
    ...process.runs[runIndex],
    status: "CONFIGURED",
    fields: {
      ...process.runs[runIndex].fields,
      ...configuration
    }
  };

  // Check if all runs are configured to move order to PRODUCTION_READY
  const allRunsConfigured = order.processes.every(p =>
    p.runs.every(r => r.status !== "NOT_CONFIGURED")
  );

  if (allRunsConfigured && order.status === "CONFIGURE") {
    order.status = "PRODUCTION_READY";
  }

  ORDERS_STORE[orderIndex] = order;
  return order;
}

/* =================================================
   UTILITY FUNCTIONS
   ================================================= */

export function getCompletedOrders(): Order[] {
  return ORDERS_STORE.filter(o => o.status === "COMPLETED");
}

export function markOrderBilled(orderId: string): void {
  ORDERS_STORE = ORDERS_STORE.map(o =>
    o.id === orderId ? { ...o, status: "BILLED" } : o
  );
}

/**
 * Check if run can be started (parallel execution - always true)
 */
export function canStartRun(
  orderId: string, 
  processId: string, 
  runId: string
): boolean {
  const order = getOrderById(orderId);
  if (!order) return false;

  const process = order.processes.find(p => p.id === processId);
  if (!process) return false;

  const run = process.runs.find(r => r.id === runId);
  if (!run) return false;

  // For parallel execution, any run can be started as long as it's configured
  return run.status === "CONFIGURED";
}