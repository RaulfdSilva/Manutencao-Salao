import type { Member } from './Member';

/** Transaction-scoped storage; deliberately exposes no deletion operation. */
export interface MemberRepository {
  findById(congregationId: string, memberId: string): Promise<Member | null>;
  list(congregationId: string): Promise<readonly Member[]>;
  countActiveAdministrators(congregationId: string): Promise<number>;
  /** Must reject duplicate identifiers, including identifiers in other congregations. */
  insert(member: Member): Promise<void>;
  /** Must update an existing member without changing identity or congregation. */
  save(member: Member): Promise<void>;
}
