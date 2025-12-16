export enum CheckStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum PageStatus {
  UNKNOWN = 'UNKNOWN',
  OPEN = 'OPEN', // Page exists (Taken)
  CLOSED = 'CLOSED', // Page not found (Likely Available)
}

export interface UsernameResult {
  id: string;
  username: string;
  status: CheckStatus;
  pageStatus: PageStatus;
  notes?: string;
  profileUrl?: string;
}

export interface ProcessingStats {
  total: number;
  processed: number;
  open: number;
  closed: number;
  errors: number;
}