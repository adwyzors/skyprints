import { ProcessRun } from "@/types/domain";

interface Props {
  run: ProcessRun;
  onClick: () => void;
}

export default function ProcessRunCard({ run, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border bg-white p-3 text-sm hover:shadow"
    >
      <div className="font-semibold">
        {run.processName} – Run {run.runNumber}
      </div>

      <div className="text-xs text-gray-600">
        Order: {run.orderNumber}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Created: {new Date(run.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
