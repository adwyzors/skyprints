"use client";

import { useState } from "react";
import { Order } from "@/types/domain";
import { getCompletedOrders } from "@/services/orders.service";
import BillingModal from "@/components/modals/BillingModal";

export default function BillingPage() {
  const [orders] = useState<Order[]>(getCompletedOrders());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Billing</h1>

      <div className="grid grid-cols-3 gap-4">
        {orders.map(order => (
          <div
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            className="border rounded p-4 cursor-pointer hover:shadow"
          >
            <div className="font-medium">{order.orderCode}</div>
            <div className="text-sm text-gray-600">
              {order.customerName}
            </div>
            <div className="text-xs mt-2">
              Quantity: {order.quantity}
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <BillingModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
