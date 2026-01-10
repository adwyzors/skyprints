// @/services/orders.service.ts

import { Order, ProcessRun, Process } from "@/types/domain";
import { NewOrderPayload } from "@/types/planning";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Local stores for offline fallback
let ORDERS_STORE: Order[] = [];
let CUSTOMERS_STORE: any[] = [];
let PROCESSES_STORE: any[] = [];

// Helper function for API calls
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      "ngrok-skip-browser-warning": "69420",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
}

/* =================================================
   CUSTOMERS
   ================================================= */

export async function getCustomers() {
  try {
    const customers = await apiRequest<any[]>('/customers');
    
    // Update local store with API data
    return customers.map(customer => ({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      isActive: customer.isActive !== undefined ? customer.isActive : true,
    }));
    
  } catch (error) {
    console.error('Error fetching customers from API:', error);
  }
}

/* =================================================
   PROCESSES
   ================================================= */

export async function getProcesses() {
  try {
    const processes = await apiRequest<any[]>('/process');
    PROCESSES_STORE = processes;
    return PROCESSES_STORE;
  } catch (error) {
    console.error('Error fetching processes from API:', error);
    return PROCESSES_STORE;
  }
}

/* =================================================
   ORDERS
   ================================================= */

export async function getOrders(filters?: {
  search?: string;
  statusCode?: string;
  dateFilter?: string;
  hideCompleted?: boolean;
}){
  try {
    // Fetch orders from API
    const orders = await apiRequest<any[]>('/orders');
    
    // Transform API response to match Order type exactly
    const transformedOrders: Order[] = orders.map(order => ({
      id: order.id,
      orderCode: order.orderCode,
      customer:{
id:order.customerId,
name: order.customerName,
    code: order.customerCode,
      },
      customerId: order.customerId,
      quantity: order.quantity,
      statusCode: order.statusCode,
      createdAt: order.createdAt,
      billedAt: order.billedAt,
      billingTotal: order.billingTotal,
      originalTotal: order.originalTotal,
      processes: order.processes.map((process: any) => ({
        id: process.id,
        quantity: process.quantity,
        runs: process.runs.map((run: any) => ({
          id: run.id,
          runNumber: run.runNumber,
          status: run.statusCode,
          fields: run.fields || {},
          location: run.location || '',
        }))
      }))
    }));
    // Apply filters
    let filtered = transformedOrders;
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderCode.toLowerCase().includes(searchLower) ||
        order.customer.name.toLowerCase().includes(searchLower) ||
        order.customer.code.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters?.statusCode && filters.statusCode !== 'all' && filters.statusCode !== 'hide_completed') {
      filtered = filtered.filter(order => order.statusCode === filters.statusCode);
    }
    
    if (filters?.hideCompleted) {
      filtered = filtered.filter(order => 
        order.statusCode !== 'COMPLETED' && order.statusCode !== 'BILLED'
      );
    }
    
    return filtered;
    
  } catch (error) {
    console.error('Error fetching orders from API:', error); 
    alert("Error fetching orders from API")
  }
}

export async function getOrderById(orderId: string): Promise<Order | undefined> {
  try {
    // Fetch single order from API
    const order = await apiRequest<any>(`/orders/${orderId}`);
    
    // Transform to Order type
    return {
      id: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      customer:{
        id:order.customerId,
name: order.customer.name,
      code: order.customer.code,
      },
      quantity: order.quantity,
      statusCode: order.statusCode,
      createdAt: order.createdAt,
      billedAt: order.billedAt,
      billingTotal: order.billingTotal,
      originalTotal: order.originalTotal,
      processes: order.processes.map((process: any) => ({
        id: process.id,
        name: process.name,
        process:{
name:process.process.name
        },
        quantity: process.quantity,
        runs: process.runs.map((run: any) => ({
          id: run.id,
          runNumber: run.runNumber,
          status: run.statusCode,
          fields: run.fields || {},
          location: run.location || '',
        }))
      }))
    };
    
  } catch (error) {
    console.error(`Error fetching order ${orderId} from API:`, error);
    return ORDERS_STORE.find(o => o.id === orderId);
  }
}

/* =================================================
   CREATE ORDER
   ================================================= */

export async function createOrder(payload: NewOrderPayload) {
  try {
    // Prepare API payload exactly as expected by your API
    const apiPayload = {
      customerId: payload.customerId,
      quantity: payload.quantity,
      processes: payload.processes
    };
    
    // Call API to create order
    const createdOrder = await apiRequest<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(apiPayload),
    })
    
  } catch (error) {
    console.error('Error creating order via API:', error);
    alert('API unavailable');
  }
}

/* =================================================
   UPDATE ORDER
   ================================================= */

export function updateOrder(updated: Order): void {
  ORDERS_STORE = ORDERS_STORE.map(o => o.id === updated.id ? updated : o);
}

/* =================================================
   RUN MANAGEMENT
   ================================================= */

export function updateRunStatus(
  orderId: string, 
  processId: string, 
  runId: string, 
  newStatus: string
): Order | undefined {
  const orderIndex = ORDERS_STORE.findIndex(o => o.id === orderId);
  if (orderIndex === -1) return undefined;

  const order = { ...ORDERS_STORE[orderIndex] };
  
  const process = order.processes.find(p => p.id === processId);
  if (!process) return undefined;

  const runIndex = process.runs.findIndex(r => r.id === runId);
  if (runIndex === -1) return undefined;

  process.runs[runIndex].statusCode = newStatus;

  const allRunsCompleted = order.processes.every(p =>
    p.runs.every(r => r.statusCode === "COMPLETED")
  );

  if (allRunsCompleted) {
    order.statusCode = "COMPLETED";
  } else if (order.statusCode === "CONFIGURE") {
    const hasActiveRuns = order.processes.some(p =>
      p.runs.some(r => r.statusCode !== "NOT_CONFIGURED" && r.statusCode !== "CONFIGURED")
    );
    
    if (hasActiveRuns) {
      order.statusCode = "IN_PRODUCTION";
    }
  }

  ORDERS_STORE[orderIndex] = order;
  return order;
}

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

  process.runs[runIndex] = {
    ...process.runs[runIndex],
    statusCode: "CONFIGURED",
    fields: {
      ...process.runs[runIndex].fields,
      ...configuration
    }
  };

  const allRunsConfigured = order.processes.every(p =>
    p.runs.every(r => r.statusCode !== "NOT_CONFIGURED")
  );

  if (allRunsConfigured && order.statusCode === "CONFIGURE") {
    order.statusCode = "PRODUCTION_READY";
  }

  ORDERS_STORE[orderIndex] = order;
  return order;
}

/* =================================================
   UTILITY FUNCTIONS
   ================================================= */

export function getCompletedOrders(): Order[] {
  return ORDERS_STORE.filter(o => o.statusCode === "COMPLETED");
}

export function markOrderBilled(orderId: string): void {
  ORDERS_STORE = ORDERS_STORE.map(o =>
    o.id === orderId ? { ...o, statusCode: "BILLED" } : o
  );
}

export function canStartRun(
  orderId: string, 
  processId: string, 
  runId: string
): boolean {
  const order = ORDERS_STORE.find(o => o.id === orderId);
  if (!order) return false;

  const process = order.processes.find(p => p.id === processId);
  if (!process) return false;

  const run = process.runs.find(r => r.id === runId);
  if (!run) return false;

  return run.statusCode === "CONFIGURED";
}