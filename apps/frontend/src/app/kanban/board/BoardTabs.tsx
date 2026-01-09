"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { label: "Board", href: "/kanban/board" },
  { label: "Billing", href: "/kanban/billing" },
  { label: "Completed Orders", href: "/kanban/completed" },
];

export default function BoardTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 px-6 pt-4 border-b bg-white">
      {tabs.map(tab => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "pb-2 text-sm font-medium relative transition",
              isActive
                ? "text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {tab.label}

            {isActive && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600 rounded" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
