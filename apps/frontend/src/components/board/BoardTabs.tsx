"use client";

import clsx from "clsx";

export type BoardTab = "BOARD" | "BILLING" | "COMPLETED";

interface Props {
  active: BoardTab;
  onChange: (tab: BoardTab) => void;
}

export default function BoardTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-6 px-6 pt-4 border-b bg-white">
      {(["BOARD", "BILLING", "COMPLETED"] as BoardTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={clsx(
            "pb-2 text-sm font-medium transition relative",
            active === tab
              ? "text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          {tab === "BOARD"
            ? "Board"
            : tab === "BILLING"
            ? "Billing"
            : "Completed Orders"}

          {active === tab && (
            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-600 rounded" />
          )}
        </button>
      ))}
    </div>
  );
}
