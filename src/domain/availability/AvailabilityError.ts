export type AvailabilityErrorCode =
  | 'INVALID_INSTANT'
  | 'INVALID_DEADLINE_DECISION'
  | 'AVAILABILITY_DISPOSED'
  | 'INVALID_RESPONSE'
  | 'INVALID_VERSION'
  | 'FORBIDDEN'
  | 'OCCURRENCE_NOT_FOUND'
  | 'OCCURRENCE_CANCELLED'
  | 'REVISION_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'WINDOW_NOT_CONFIGURED'
  | 'WINDOW_CLOSED'
  | 'WINDOW_ALREADY_OPEN'
  | 'INVALID_DEADLINE';
export class AvailabilityError extends Error {
  override readonly name = 'AvailabilityError';
  constructor(readonly code: AvailabilityErrorCode) {
    super(code);
  }
}
