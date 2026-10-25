export type MaintenanceErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_CATEGORY'
  | 'INVALID_RECURRENCE'
  | 'INVALID_DATE'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_TIME'
  | 'INVALID_RANGE'
  | 'RANGE_TOO_LARGE'
  | 'INVALID_QUANTITIES'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_VERSION'
  | 'INVALID_AVAILABILITY_DECISION'
  | 'INVALID_STATUS'
  | 'OCCURRENCE_CANCELLED'
  | 'TEAM_NOT_ALLOWED';

export class MaintenanceError extends Error {
  override readonly name = 'MaintenanceError';
  constructor(public readonly code: MaintenanceErrorCode) {
    super(code);
  }
}
