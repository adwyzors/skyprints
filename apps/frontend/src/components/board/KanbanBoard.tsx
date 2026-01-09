import { ProcessRun, ProcessRunStatus } from "@/types/domain";
import KanbanColumn from "./KanbanColumn";

interface Props {
  runs: ProcessRun[];
  onSelectRun: (run: ProcessRun) => void;
}

const COLUMNS: { key: ProcessRunStatus; title: string }[] = [
  { key: "TODO", title: "To Do" },
  { key: "ASSIGNED", title: "Assigned" },
  { key: "IN_PROGRESS", title: "In Progress" },
  { key: "HALTED", title: "Halted" },
  { key: "COMPLETED", title: "Completed" },
];

export default function KanbanBoard({ runs, onSelectRun }: Props) {
  return (
    <div className="flex flex-1 gap-4 p-4 overflow-x-auto">
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.key}
          title={col.title}
          runs={runs.filter(r => r.status === col.key)}
          onSelectRun={onSelectRun}
        />
      ))}
    </div>
  );
}
