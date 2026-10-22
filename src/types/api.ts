export interface ApiEnvelope<T> {
  data: T;
  requestId?: string;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface ApiErrorBody {
  code?: string;
  message: string;
  details?: unknown;
}
