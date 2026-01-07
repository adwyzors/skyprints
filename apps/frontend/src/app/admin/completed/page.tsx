"use client";

import { Order } from "@/types/domain";
import { getOrders } from "@/services/orders.service";

export default function CompletedPage() {
  const orders = getOrders().filter(
    o => o.status === "BILLED"
  );

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">
        Completed Orders
      </h1>

      <div className="grid grid-cols-3 gap-4">
        {orders.map(order => (
          <div key={order.id} className="border rounded p-4">
            <div className="font-medium">
              {order.orderCode}
            </div>
            <div className="text-sm text-gray-600">
              {order.customerName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
