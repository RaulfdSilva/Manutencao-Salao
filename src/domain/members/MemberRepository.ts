import type { Member } from './Member';

/** Transaction-scoped storage; deliberately exposes no deletion operation. */
export interface MemberRepository {
  findById(congregationId: string, memberId: string): Promise<Member | null>;
  list(congregationId: string): Promise<readonly Member[]>;
  countActiveAdministrators(congregationId: string): Promise<number>;
  /** Must reject duplicate identifiers, including identifiers in other congregations. */
  insert(member: Member): Promise<void>;
  /**
   * Atomically compare id + congregation + stored version with expectedVersion
   * and replace the record with member (version MUST be expectedVersion + 1).
   * Return false, with no writes, if the record is absent or its version changed.
   * A database adapter must use a conditional write and inspect affected rows;
   * a separate read followed by an unconditional write does NOT satisfy this.
   * Must participate in the same transaction as assignments and audit.
   */
  saveIfVersion(member: Member, expectedVersion: number): Promise<boolean>;
}
