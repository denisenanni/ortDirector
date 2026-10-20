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

/** A bed, a group of pots, the greenhouse: where plants live. */
export interface Zone {
  id: number;
  name: string;
  /** The sun the spot actually gets. */
  sun: Sun;
  /** Greenhouse, under a roof, indoors: rain doesn't reach it. */
  covered: boolean;
}

export interface Plant {
  id: number;
  name: string;
  variety: string | null;
  /** Free-text position from before zones; shown only when there's no zone. */
  location: string | null;
  zoneId: number | null;
  /** Lives in a pot for good. */
  potted: boolean;
  /** The sun the plant needs. */
  sun: Sun;
  /** Watering interval in the warm months (May to September). */
  waterEveryDays: number | null;
  /** Watering interval the rest of the year; null means the same. */
  waterColdDays: number | null;
  stage: Stage;
  /** Sowing day, for plants grown from seed. */
  sownOn: DayString | null;
  /** Day it went into its final spot (transplant or planting). */
  plantedOn: DayString | null;
  /** Catalog entry the plant was created from, which picks its care plan. */
  preset: string | null;
  /** Lives one season (most vegetables): archived at the end instead of deleted. */
  annual: boolean;
  /** Day it was archived; archived plants keep their history but have no tasks. */
  archivedOn: DayString | null;
  /** The plant's photo: a file name in the app's photo folder, or a data URL on web. */
  photo: string | null;
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
  /** Repeats once a year instead of every `repeatDays`. */
  yearly: boolean;
  /** Months (1-12) the task may fall in; null means all year. */
  months: number[] | null;
  /** Interval outside the warm months; null means `repeatDays` all year. */
  coldRepeatDays: number | null;
  doneOn: DayString | null;
  notes: string | null;
}

/** A task joined with the name of its plant, for lists. */
export interface TaskWithPlant extends Task {
  plantName: string | null;
  plantVariety: string | null;
  zoneName: string | null;
}

export interface LogEntry {
  id: number;
  taskId: number | null;
  plantId: number | null;
  type: TaskType;
  title: string;
  doneOn: DayString;
}

/** A history entry as Oggi shows it: ticked today, possibly to undo. */
export interface DoneEntry extends LogEntry {
  /** The day the task was due before it was ticked; null for ticks from before v5. */
  prevDueOn: DayString | null;
  plantName: string | null;
  plantVariety: string | null;
  zoneName: string | null;
}
