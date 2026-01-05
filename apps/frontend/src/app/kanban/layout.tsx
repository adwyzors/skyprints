import AppHeader from "@/components/layout/AppHeader";
import BoardTabs from "@/app/kanban/board/BoardTabs";

export default function KanbanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader />
      <BoardTabs />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
