'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

import { getOrderById } from '@/services/orders.service';
import { Order } from '@/model/order.model';
import ScreenPrintingConfig from '@/components/orders/ScreenPrintingConfig';
import ComingSoonConfig from '@/components/orders/ComingSoonConfig';

export default function OrderConfigPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOrderData = async () => {
      if (!orderId) return;

      setLoading(true);
      setError(null);

      try {
        const orderData = await getOrderById(orderId);
        if (!cancelled) {
          if (!orderData) throw new Error('Order not found');
          setOrder(orderData);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err instanceof Error ? err.message : 'Failed to load order');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrderData();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Function to refresh order data
  const refreshOrder = async () => {
    if (!orderId) return;
    try {
      const refreshed = await getOrderById(orderId);
      if (refreshed) {
        setOrder(refreshed);
      }
    } catch (err) {
      console.error('Failed to refresh order:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order configuration...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{error || 'Order not found'}</h2>
          <button
            onClick={() => router.push('/admin/orders')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // Get the main process to determine which form to show
  const mainProcess = order.processes[0];
  const processName = mainProcess?.processName;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => router.push('/admin/orders')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Orders</span>
                </button>
                <div className="h-6 w-px bg-gray-300 hidden md:block" />
                <h1 className="text-2xl font-bold text-gray-800">{order.code}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-sm text-gray-600">
                    {order.customer?.name || `Customer ${order.customer?.id}`} (
                    {order.customer?.code || order.customer?.id})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-600">Quantity: {order.quantity}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  order.status === 'PRODUCTION_READY'
                    ? 'bg-green-100 text-green-800'
                    : order.status === 'CONFIGURE'
                      ? 'bg-yellow-100 text-yellow-800'
                      : order.status === 'IN_PRODUCTION'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'COMPLETED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                }`}
              >
                {order.status?.replace('_', ' ') || 'Unknown'}
              </div>
              <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {order.processes.length} Process{order.processes.length !== 1 ? 'es' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* PROCESS NAVIGATION */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Processes</h3>
          <div className="flex flex-wrap gap-3">
            {order.processes.map((process) => (
              <div
                key={process.id}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  processName === process.processName
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="font-medium">{process.processName}</span>
                  <span className="text-xs bg-white px-2 py-0.5 rounded-full">
                    {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CONFIGURATION COMPONENT */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {processName === 'Screen Printing' ? (
            <ScreenPrintingConfig order={order} onRefresh={refreshOrder} />
          ) : (
            <ComingSoonConfig order={order} />
          )}
        </div>

        {/* FOOTER - START PRODUCTION BUTTON */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Order Configuration Summary</p>
              <p className="mt-1">
                Configure all runs to move this order to{' '}
                <span className="font-semibold text-green-600">PRODUCTION_READY</span> status
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Configured Runs</p>
                <p className="text-2xl font-bold text-gray-800">
                  {
                    order.processes
                      .flatMap((p) => p.runs)
                      .filter((r) => r.statusCode === 'CONFIGURED').length
                  }
                  <span className="text-sm font-normal text-gray-400">
                    {' '}
                    / {order.processes.flatMap((p) => p.runs).length}
                  </span>
                </p>
              </div>

              {/* Check if all runs are configured */}
              {order.processes.flatMap((p) => p.runs).every((r) => r.statusCode === 'CONFIGURED') &&
                order.status === 'CONFIGURE' && (
                  <button
                    onClick={() => {
                      router.push(`/admin/orders?selectedOrder=${order.id}`);
                    }}
                    className="px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow"
                  >
                    Start Production
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
