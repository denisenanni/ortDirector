export type Sun = 'full' | 'partial' | 'shade';

export type TaskType =
  | 'water'
  | 'check'
  | 'prune'
  | 'fertilize'
  | 'treat'
  | 'harvest'
  | 'other';

/** Calendar day in local time, formatted YYYY-MM-DD. */
export type DayString = string;

export interface Plant {
  id: number;
  name: string;
  variety: string | null;
  location: string | null;
  sun: Sun;
  waterEveryDays: number | null;
  plantedOn: DayString | null;
  notes: string | null;
}

export interface Task {
  id: number;
  plantId: number | null;
  type: TaskType;
  title: string;
  dueOn: DayString;
  repeatDays: number | null;
  doneOn: DayString | null;
  notes: string | null;
}

/** A task joined with the name of its plant, for lists. */
export interface TaskWithPlant extends Task {
  plantName: string | null;
}

export interface LogEntry {
  id: number;
  taskId: number | null;
  plantId: number | null;
  type: TaskType;
  title: string;
  doneOn: DayString;
}
