/**
 * Common Type Definitions
 */

import { RequestStatus } from "@prisma/client";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
  pagination?: PaginationMeta;
}

export interface HealthCheckResponse {
  success: boolean;
  timestamp: string;
  uptime: number;
  services: {
    database: boolean;
    didblockchain: boolean;
    vcblockchain: boolean;
  };
}

export type StatusFilter = RequestStatus | undefined;

export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}
