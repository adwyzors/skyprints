'use client';

import React from 'react';
import { Clock, Construction } from 'lucide-react';
import { Order } from '@/model/order.model';

interface ComingSoonConfigProps {
  order: Order;
}

export default function ComingSoonConfig({ order }: ComingSoonConfigProps) {
  return (
    <div className="space-y-6">
      {/* INFO CARD */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <Construction className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Configuration Interface Coming Soon
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            The configuration interface for {order.processes.map((p) => p.processName).join(', ')}{' '}
            processes is currently under development. For now, you can proceed with basic order
            management.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Available in the next update</span>
          </div>
        </div>
      </div>

      {/* PROCESS OVERVIEW */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Processes</h3>
        <div className="space-y-4">
          {order.processes.map((process, index) => (
            <div
              key={process.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="font-medium text-gray-700">{index + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">{process.processName}</h4>
                  <p className="text-sm text-gray-500">
                    {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                Coming Soon
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
