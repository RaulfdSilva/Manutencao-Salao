export type MaintenanceOperationErrorCode =
  | 'FORBIDDEN'
  | 'RULE_NOT_FOUND'
  | 'OCCURRENCE_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'MEMBER_NOT_ELIGIBLE'
  | 'IDENTIFIER_CONFLICT';
export class MaintenanceOperationError extends Error {
  override readonly name = 'MaintenanceOperationError';
  constructor(public readonly code: MaintenanceOperationErrorCode) {
    super(code);
  }
}
