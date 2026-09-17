export interface RecalculateProgressActivity {
  id: string;
  name: string;
  startTime: string;
}

export interface RecalculateProgressError {
  activityId: string;
  message: string;
}

export interface RecalculateProgress {
  isRecalculating: boolean;
  totalToProcess: number;
  processedCount: number;
  currentActivity: RecalculateProgressActivity | null;
  errors: RecalculateProgressError[];
  startedAt: string | null;
  completedAt: string | null;
}
