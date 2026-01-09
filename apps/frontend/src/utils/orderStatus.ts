import { Order } from "@/types/domain";

export function isOrderProductionReady(order: Order): boolean {
  return order.processes.every(p =>
    p.runs.every(r =>
      Object.values(r.fields).every(
        v => v !== null && v !== ""
      )
    )
  );
}

export function isOrderInProduction(order: Order): boolean {
  return order.processes.some(p =>
    p.runs.some(r => r.status !== "DESIGN")
  );
}

export function isOrderCompleted(order: Order): boolean {
  return order.processes.every(p =>
    p.runs.every(r => r.status === "COMPLETED")
  );
}
