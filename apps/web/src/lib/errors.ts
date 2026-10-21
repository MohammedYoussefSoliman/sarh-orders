import axios from 'axios';

import type { ApiErrorResponse } from '@/types';

export type NormalizedError = {
  status: number | null;
  /** Human-readable message safe to surface in the UI. */
  message: string;
};

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'The submitted data is invalid. Please review and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource is unavailable.',
  409: 'This action conflicts with the current state of the record.',
  422: 'This order changed after it was sent. Start a new order.',
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again shortly.',
};

/**
 * Convert any thrown value into a predictable shape for toasts and inline
 * errors. The backend's status codes stay authoritative — success is never
 * inferred from a failed request.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const status = error.response?.status ?? null;
    const body = error.response?.data;
    const message =
      body?.message ||
      (status ? DEFAULT_MESSAGES[status] : undefined) ||
      error.message ||
      'Request failed.';
    return { status, message };
  }

  if (error instanceof Error) {
    return { status: null, message: error.message };
  }

  return { status: null, message: 'An unexpected error occurred.' };
}

export const isStatus = (error: unknown, status: number): boolean =>
  axios.isAxiosError(error) && error.response?.status === status;
