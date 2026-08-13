/**
 * Structured domain errors per spec section 97. Server actions throw these;
 * UI code maps `code` to a friendly message rather than showing raw errors.
 */
export type DomainErrorCode =
  | 'SLOT_NOT_AVAILABLE'
  | 'BOOKING_ALREADY_ASSIGNED'
  | 'PERMISSION_DENIED'
  | 'CUSTOMER_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'UPI_NOT_CONFIGURED'
  | 'INVOICE_ALREADY_FINALIZED'
  | 'PAYMENT_ALREADY_CONFIRMED'
  | 'SUBSCRIPTION_INACTIVE'
  | 'NOT_A_BUSINESS_MEMBER'
  | 'BRANCH_ACCESS_DENIED'
  | 'VALIDATION_ERROR';

export class DomainError extends Error {
  code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}

export const FRIENDLY_MESSAGES: Record<DomainErrorCode, string> = {
  SLOT_NOT_AVAILABLE: 'That time slot is no longer available.',
  BOOKING_ALREADY_ASSIGNED: 'This booking has already been assigned to someone else.',
  PERMISSION_DENIED: "You don't have permission to do that.",
  CUSTOMER_NOT_FOUND: "We couldn't find that customer.",
  INVALID_STATE_TRANSITION: "That action isn't allowed at this stage.",
  UPI_NOT_CONFIGURED: 'This branch has not set up UPI payment details yet.',
  INVOICE_ALREADY_FINALIZED: 'This invoice has already been finalized and cannot be changed.',
  PAYMENT_ALREADY_CONFIRMED: 'This payment has already been confirmed.',
  SUBSCRIPTION_INACTIVE: "This business's subscription is not active.",
  NOT_A_BUSINESS_MEMBER: "You don't have access to this business.",
  BRANCH_ACCESS_DENIED: "You don't have access to this branch.",
  VALIDATION_ERROR: 'Please check the information you entered.',
};
