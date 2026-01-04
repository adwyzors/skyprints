import { Order } from "@/types/domain";

interface Props {
  orders: Order[];
  selectedOrderId?: string;
  onSelect: (orderId: string) => void;
}

export default function OrdersSidebar({
  orders,
  selectedOrderId,
  onSelect,
}: Props) {
  return (
    <aside className="w-72 border-r bg-gray-50 overflow-y-auto">
      <h2 className="px-4 py-3 font-semibold text-sm">Orders</h2>

      <div className="space-y-2 px-3 pb-4">
        {orders.map(order => {
          const isSelected = selectedOrderId === order.id;

          return (
            <div
              key={order.id}
              onClick={() => onSelect(order.id)}
              className={`
                cursor-pointer rounded-lg border p-3 text-sm
                ${isSelected ? "bg-black text-white" : "bg-white hover:bg-gray-100"}
              `}
            >
              <div className="font-semibold">
                {order.orderNumber}
              </div>

              <div className="text-xs opacity-80">
                {order.customerName}
              </div>

              <div className="mt-2 flex justify-between text-xs">
                <span>Qty: {order.quantity}</span>
                <span
                  className={
                    order.completed
                      ? "text-green-600"
                      : order.productionReady
                      ? "text-blue-600"
                      : "text-orange-600"
                  }
                >
                  {order.completed
                    ? "Completed"
                    : order.productionReady
                    ? "Production Ready"
                    : "Pending"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
