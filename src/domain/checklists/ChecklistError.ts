export type ChecklistErrorCode =
  | 'INVALID_PROBLEM_STATE'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TEMPLATE_NOT_CONFIGURED'
  | 'CHECKLIST_NOT_INITIALIZED'
  | 'VERSION_CONFLICT'
  | 'COMMAND_ID_REUSED'
  | 'INVALID_TEXT'
  | 'INVALID_RESULT'
  | 'DUPLICATE_VERIFICATION'
  | 'VERIFICATION_NOT_FOUND'
  | 'CHECKLIST_SEALED'
  | 'CORRECTION_REQUIRES_COMPLETION'
  | 'PROBLEM_DETAILS_MISMATCH'
  | 'INVALID_PROBLEM_LINK';
export class ChecklistError extends Error {
  override readonly name = 'ChecklistError';
  constructor(readonly code: ChecklistErrorCode) {
    super(code);
  }
}
