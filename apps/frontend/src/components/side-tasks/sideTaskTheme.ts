import { SideTaskPriority, SideTaskType } from '@/types/sideTask';

export interface TaskCardTheme {
  bg: string;
  border: string;
  isDark: boolean;
  typeBadge: {
    bg: string;
    text: string;
    border?: string;
  };
  priorityBadge: {
    bg: string;
    text: string;
  };
}

export const TASK_COLOR_MATRIX: Record<SideTaskType, Record<SideTaskPriority, TaskCardTheme>> = {
  FIVE_MIN: {
    LOW: {
      bg: 'bg-[#e0f2fe]',
      border: 'border-[#bae6fd]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-sky-700', border: 'border-sky-200' },
      priorityBadge: { bg: 'bg-[#38bdf8]', text: 'text-white' },
    },
    MEDIUM: {
      bg: 'bg-[#7dd3fc]',
      border: 'border-[#38bdf8]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-sky-800', border: 'border-sky-300' },
      priorityBadge: { bg: 'bg-[#0284c7]', text: 'text-white' },
    },
    HIGH: {
      bg: 'bg-[#2563eb]',
      border: 'border-[#1d4ed8]',
      isDark: true,
      typeBadge: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30' },
      priorityBadge: { bg: 'bg-[#1e40af]', text: 'text-white' },
    },
    URGENT: {
      bg: 'bg-[#0052cc]',
      border: 'border-[#003d99]',
      isDark: true,
      typeBadge: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30' },
      priorityBadge: { bg: 'bg-[#0f172a]', text: 'text-white' },
    },
  },
  HALF_HOUR: {
    LOW: {
      bg: 'bg-[#fff7ed]',
      border: 'border-[#fed7aa]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-amber-800', border: 'border-amber-200' },
      priorityBadge: { bg: 'bg-[#fb923c]', text: 'text-white' },
    },
    MEDIUM: {
      bg: 'bg-[#fed7aa]',
      border: 'border-[#fdba74]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-amber-900', border: 'border-amber-300' },
      priorityBadge: { bg: 'bg-[#ea580c]', text: 'text-white' },
    },
    HIGH: {
      bg: 'bg-[#fdba74]',
      border: 'border-[#fb923c]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-amber-950', border: 'border-amber-400' },
      priorityBadge: { bg: 'bg-[#c2410c]', text: 'text-white' },
    },
    URGENT: {
      bg: 'bg-[#78350f]',
      border: 'border-[#451a03]',
      isDark: true,
      typeBadge: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30' },
      priorityBadge: { bg: 'bg-[#451a03]', text: 'text-white' },
    },
  },
  LONG: {
    LOW: {
      bg: 'bg-[#f1f5f9]',
      border: 'border-[#cbd5e1]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-slate-700', border: 'border-slate-300' },
      priorityBadge: { bg: 'bg-[#94a3b8]', text: 'text-white' },
    },
    MEDIUM: {
      bg: 'bg-[#cbd5e1]',
      border: 'border-[#94a3b8]',
      isDark: false,
      typeBadge: { bg: 'bg-white/90', text: 'text-slate-800', border: 'border-slate-400' },
      priorityBadge: { bg: 'bg-[#475569]', text: 'text-white' },
    },
    HIGH: {
      bg: 'bg-[#64748b]',
      border: 'border-[#475569]',
      isDark: true,
      typeBadge: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30' },
      priorityBadge: { bg: 'bg-[#1e293b]', text: 'text-white' },
    },
    URGENT: {
      bg: 'bg-[#1e293b]',
      border: 'border-[#0f172a]',
      isDark: true,
      typeBadge: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30' },
      priorityBadge: { bg: 'bg-[#020617]', text: 'text-white' },
    },
  },
};

export const TASK_TYPE_LABELS: Record<SideTaskType, string> = {
  FIVE_MIN: '5 min',
  HALF_HOUR: 'Half an hr',
  LONG: 'Long',
};

export const PRIORITY_LABELS: Record<SideTaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function getTaskCardTheme(
  taskType?: SideTaskType | null,
  priority: SideTaskPriority = 'MEDIUM',
): TaskCardTheme {
  const type = taskType || 'FIVE_MIN';
  const row = TASK_COLOR_MATRIX[type] || TASK_COLOR_MATRIX.FIVE_MIN;
  return row[priority] || row.MEDIUM;
}

export const LEGEND_ROWS: {
  type: SideTaskType;
  label: string;
  cols: { priority: SideTaskPriority; bg: string; border: string }[];
}[] = [
  {
    type: 'FIVE_MIN',
    label: '5 min',
    cols: [
      { priority: 'LOW', bg: 'bg-[#e0f2fe]', border: 'border-[#bae6fd]' },
      { priority: 'MEDIUM', bg: 'bg-[#7dd3fc]', border: 'border-[#38bdf8]' },
      { priority: 'HIGH', bg: 'bg-[#2563eb]', border: 'border-[#1d4ed8]' },
      { priority: 'URGENT', bg: 'bg-[#0052cc]', border: 'border-[#003d99]' },
    ],
  },
  {
    type: 'HALF_HOUR',
    label: 'Half an hr',
    cols: [
      { priority: 'LOW', bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]' },
      { priority: 'MEDIUM', bg: 'bg-[#fed7aa]', border: 'border-[#fdba74]' },
      { priority: 'HIGH', bg: 'bg-[#fdba74]', border: 'border-[#fb923c]' },
      { priority: 'URGENT', bg: 'bg-[#78350f]', border: 'border-[#451a03]' },
    ],
  },
  {
    type: 'LONG',
    label: 'Long',
    cols: [
      { priority: 'LOW', bg: 'bg-[#f1f5f9]', border: 'border-[#cbd5e1]' },
      { priority: 'MEDIUM', bg: 'bg-[#cbd5e1]', border: 'border-[#94a3b8]' },
      { priority: 'HIGH', bg: 'bg-[#64748b]', border: 'border-[#475569]' },
      { priority: 'URGENT', bg: 'bg-[#1e293b]', border: 'border-[#0f172a]' },
    ],
  },
];
