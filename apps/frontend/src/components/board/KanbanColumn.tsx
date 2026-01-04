import { ProcessRun } from "@/types/domain";
import ProcessRunCard from "./ProcessRunCard";

interface Props {
  title: string;
  runs: ProcessRun[];
  onSelectRun: (run: ProcessRun) => void;
}

export default function KanbanColumn({
  title,
  runs,
  onSelectRun,
}: Props) {
  return (
    <div className="w-72 bg-gray-100 rounded-lg flex flex-col">
      <div className="px-3 py-2 font-semibold text-sm border-b">
        {title} ({runs.length})
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {runs.map(run => (
          <ProcessRunCard
            key={run.id}
            run={run}
            onClick={() => onSelectRun(run)}
          />
        ))}
      </div>
    </div>
  );
}
