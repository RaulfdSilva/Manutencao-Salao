export type MemberOperationErrorCode =
  | 'FORBIDDEN'
  | 'MEMBER_NOT_FOUND'
  | 'LAST_ACTIVE_ADMINISTRATOR'
  | 'MEMBER_ALREADY_EXISTS'
  | 'MEMBER_VERSION_CONFLICT';

export class MemberOperationError extends Error {
  override readonly name = 'MemberOperationError';

  constructor(public readonly code: MemberOperationErrorCode) {
    super(code);
  }
}
