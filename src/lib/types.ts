export type Sun = 'full' | 'partial' | 'shade';

export type TaskType =
  | 'water'
  | 'check'
  | 'prune'
  | 'fertilize'
  | 'treat'
  | 'harvest'
  | 'transplant'
  | 'other';

/** Where a plant is: still in the seedbed or a nursery pot, or in its final spot. */
export type Stage = 'seedbed' | 'ground';

/** Calendar day in local time, formatted YYYY-MM-DD. */
export type DayString = string;

export interface Plant {
  id: number;
  name: string;
  variety: string | null;
  location: string | null;
  sun: Sun;
  waterEveryDays: number | null;
  stage: Stage;
  /** Sowing day, for plants grown from seed. */
  sownOn: DayString | null;
  /** Day it went into its final spot (transplant or planting). */
  plantedOn: DayString | null;
  /** Catalog entry the plant was created from, which picks its care plan. */
  preset: string | null;
  notes: string | null;
}

export interface Task {
  id: number;
  plantId: number | null;
  type: TaskType;
  title: string;
  dueOn: DayString;
  repeatDays: number | null;
  /** Last day a repeating task may fall on; after it the task closes. */
  endsOn: DayString | null;
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
