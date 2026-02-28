import { ErrorCode } from '@/types';

export class BillingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function asBillingError(error: unknown): BillingError {
  if (error instanceof BillingError) {
    return error;
  }

  if (error instanceof Error) {
    return new BillingError(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }

  return new BillingError(ErrorCode.INTERNAL_ERROR, 'Unexpected billing error', 500);
}
