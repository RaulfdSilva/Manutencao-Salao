export type MemberErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_NAME'
  | 'INVALID_PHONE'
  | 'INVALID_ROLE'
  | 'INVALID_STATUS';

export class MemberError extends Error {
  override readonly name = 'MemberError';

  constructor(public readonly code: MemberErrorCode) {
    super(code);
  }
}
