import { DomainError, type DomainErrorCode } from '../errors';

const KNOWN_CODES = new Set<string>([
  'SLOT_NOT_AVAILABLE',
  'BOOKING_ALREADY_ASSIGNED',
  'PERMISSION_DENIED',
  'CUSTOMER_NOT_FOUND',
  'INVALID_STATE_TRANSITION',
  'UPI_NOT_CONFIGURED',
  'INVOICE_ALREADY_FINALIZED',
  'PAYMENT_ALREADY_CONFIRMED',
  'SUBSCRIPTION_INACTIVE',
  'NOT_A_BUSINESS_MEMBER',
  'BRANCH_ACCESS_DENIED',
  'VALIDATION_ERROR',
]);

/**
 * Postgres RPC functions in supabase/migrations/0003_server_operations.sql
 * raise exceptions whose message IS the domain error code (e.g.
 * `raise exception 'PERMISSION_DENIED'`). supabase-js surfaces that as
 * error.message. This turns it back into a typed DomainError so UI code
 * never has to string-match a raw Postgres error itself.
 */
export function toDomainError(error: { message: string } | null): DomainError {
  const message = error?.message ?? '';
  const code = (KNOWN_CODES.has(message) ? message : 'VALIDATION_ERROR') as DomainErrorCode;
  return new DomainError(code, error?.message || 'Something went wrong.');
}
