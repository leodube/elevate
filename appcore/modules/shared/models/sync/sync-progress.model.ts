export interface SyncProgressCurrentActivity {
  id: string;
  name: string;
  startTime: string;
}

export interface SyncProgress {
  isSyncing: boolean;
  totalFound: number | null;
  processedCount: number;
  skippedCount: number;
  currentActivity: SyncProgressCurrentActivity | null;
  errors: { activityId: string; message: string }[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface SyncStatusResponse extends SyncProgress {
  lastSyncedAt: string | null;
}
