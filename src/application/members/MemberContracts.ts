import type { MemberRole, MemberStatus } from '../../domain/members/Member';
import type { MemberRepository } from '../../domain/members/MemberRepository';

/** Must be supplied by a trusted server identity resolver, never trusted from request input. */
export interface MemberActor {
  readonly memberId: string;
  readonly congregationId: string;
}

export type MemberAuditAction =
  | 'created'
  | 'profile_updated'
  | 'role_changed'
  | 'deactivated'
  | 'reactivated';

export interface MemberAuditState {
  readonly role: MemberRole;
  readonly status: MemberStatus;
  readonly version: number;
}

export interface MemberAuditEvent {
  readonly actorId: string;
  readonly congregationId: string;
  readonly memberId: string;
  readonly action: MemberAuditAction;
  readonly occurredAt: string;
  readonly before: MemberAuditState | null;
  readonly after: MemberAuditState;
}

export interface FutureAssignments {
  /**
   * Release future assignments at the supplied cutoff and audit each removal.
   * Preserve past execution/history. Participate in the SAME transaction as the
   * member update; an external best-effort call does not satisfy this contract.
   */
  releaseForMember(input: {
    readonly congregationId: string;
    readonly memberId: string;
    readonly actorId: string;
    readonly effectiveAt: string;
  }): Promise<void>;
}

export interface MemberUnitOfWork {
  readonly members: MemberRepository;
  readonly futureAssignments: FutureAssignments;
  readonly audit: { append(event: MemberAuditEvent): Promise<void> };
}

export interface MemberTransactions {
  /**
   * Serialize operations within a congregation, including actor/administrator
   * reads, and atomically commit or roll back ALL writes, assignments and audit.
   * A future server/database adapter must enforce this, not an in-process mutex.
   */
  run<T>(
    congregationId: string,
    work: (transaction: MemberUnitOfWork) => Promise<T>,
  ): Promise<T>;
}

export interface MemberDependencies {
  readonly transactions: MemberTransactions;
  readonly ids: { next(): string };
  /** ISO-8601 timestamp supplied by the trusted runtime. */
  readonly clock: { now(): string };
}

export interface PublicMemberView {
  readonly id: string;
  readonly congregationId: string;
  readonly name: string;
  readonly role: MemberRole;
  readonly status: MemberStatus;
  readonly version: number;
}

export interface AdministratorMemberView extends PublicMemberView {
  readonly phone: string | null;
}

export type MemberView = PublicMemberView | AdministratorMemberView;
