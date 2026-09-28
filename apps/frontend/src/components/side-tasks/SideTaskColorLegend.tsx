'use client';

import { LEGEND_ROWS } from './sideTaskTheme';

export function SideTaskColorLegend() {
  return (
    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-2xs">
      <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-x-2 gap-y-1 items-center">
        {/* Header row */}
        <div></div>
        <div className="text-[10px] text-gray-500 font-medium text-center">Low</div>
        <div className="text-[10px] text-gray-500 font-medium text-center">Medium</div>
        <div className="text-[10px] text-gray-500 font-medium text-center">High</div>
        <div className="text-[10px] text-gray-500 font-medium text-center">Urgent</div>

        {/* Data rows */}
        {LEGEND_ROWS.map((row) => (
          <div key={row.type} className="contents">
            <span className="text-[10px] text-gray-600 font-medium whitespace-nowrap pr-1 text-right">
              {row.label}
            </span>
            {row.cols.map((col) => (
              <div
                key={col.priority}
                className={`w-7 h-3 rounded-xs ${col.bg} border ${col.border}`}
                title={`${row.label} • ${col.priority}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
