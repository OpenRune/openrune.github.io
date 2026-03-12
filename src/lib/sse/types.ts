import type { ServerStatus } from "@/lib/cache-status";

export enum SseEventType {
  STATUS = "STATUS",
  ACTIVITY = "ACTIVITY",
  ZIP_PROGRESS = "ZIP_PROGRESS",
}

export interface StatusResponse {
  status: ServerStatus;
  game: string;
  revision: number;
  environment: string;
  port: number;
  statusMessage?: string | null;
  progress?: number | null;
  fileCrcs?: Record<string, number> | null;
}

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
}

export type SseEventDataMap = {
  [SseEventType.STATUS]: StatusResponse;
  [SseEventType.ACTIVITY]: unknown;
  [SseEventType.ZIP_PROGRESS]: unknown;
};
