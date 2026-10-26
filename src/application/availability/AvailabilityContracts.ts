import {
  assertIdentifier,
  assertVersion,
} from '../../domain/maintenance/MaintenanceTypes';
import { instant } from '../../domain/availability/AvailabilityPlan';
import type { TechnicalCompletionReceipt } from '../maintenance/MaintenanceLifecycleContracts';
import type { MemberRepository } from '../../domain/members/MemberRepository';
import type { OccurrenceRepository } from '../../domain/maintenance/MaintenanceRepository';
import type { AvailabilityPlan } from '../../domain/availability/AvailabilityPlan';

export interface AvailabilityRepository {
  find(
    congregationId: string,
    occurrenceId: string,
    revision: number,
  ): Promise<AvailabilityPlan | null>;
  /** Unique scope/occurrence/revision; true only on insertion, no writes on false. */
  insertIfAbsent(plan: AvailabilityPlan): Promise<boolean>;
  /** Atomic scoped CAS, unchanged identity/revision, version = expected + 1; no writes on false. */
  saveIfVersion(plan: AvailabilityPlan, expected: number): Promise<boolean>;
}
export interface AvailabilityDeadline {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly revision: number;
  readonly windowGeneration: number;
  readonly deadline: string;
}
export type AvailabilityEventKind =
  | 'window_configured'
  | 'deadline_changed'
  | 'invitation_needed'
  | 'response_recorded'
  | 'response_modified'
  | 'late_unavailability'
  | 'window_closed'
  | 'window_reopened'
  | 'eligibility_changed'
  | 'reconfirmation_required';
export interface AvailabilityEvent {
  readonly id: string;
  readonly kind: AvailabilityEventKind;
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly revision: number;
  readonly version: number;
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly memberId: string | null;
  readonly invitationGeneration: number | null;
  readonly windowGeneration: number;
}
export interface AvailabilityUnitOfWork {
  readonly members: Pick<MemberRepository, 'findById' | 'list'>;
  readonly occurrences: Pick<OccurrenceRepository, 'findById'>;
  readonly availability: AvailabilityRepository;
  readonly retention: AvailabilityRetention;
  readonly events: { append(event: AvailabilityEvent): Promise<void> };
  /** Durable upsert by scope/occurrence/revision/windowGeneration, in the SAME transaction. */
  readonly deadlines: {
    schedule(command: AvailabilityDeadline): Promise<void>;
  };
}
export interface AvailabilityDependencies {
  /** Shared serialization with members/maintenance, including eligibility reads, CAS, outbox and deadline jobs. */
  readonly transactions: {
    run<T>(
      scope: string,
      work: (tx: AvailabilityUnitOfWork) => Promise<T>,
    ): Promise<T>;
  };
  /** Canonical UTC ISO-8601 with milliseconds, supplied by the trusted server. */
  readonly clock: { now(): string };
}
export interface AvailabilityPlanning {
  readonly version: number;
  readonly revision: number;
  readonly open: boolean;
  readonly deadline: string;
  readonly totals: Readonly<
    Record<'yes' | 'no' | 'maybe' | 'unanswered', number>
  >;
  readonly belowMinimum: boolean;
}

/** Nonpersonal tombstone preventing replay by pending offline commands. */
export interface AvailabilityDisposal {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly terminal: 'cancelled' | 'completed';
  readonly sourceVersion: number;
  readonly effectiveAt: string;
}
export interface AvailabilityRetention {
  find(
    congregationId: string,
    occurrenceId: string,
  ): Promise<AvailabilityDisposal | null>;
  /**
   * SAME transaction: tombstone + remove ALL availability revisions, invitations,
   * individual outbox events (including personal IDs in event keys), deadline jobs
   * and delivery projections. Keep only whitelisted operational maintenance facts.
   * Idempotent; reject newer/conflicting terminal receipts.
   * Real adapter propagates erasure to caches/offline queues and tracks backup
   * expiry/restore suppression, without claiming immediate physical erasure.
   */
  discardOccurrence(request: AvailabilityDisposal): Promise<void>;
}
/** Contract only. The future completion transaction must verify the real receipt and erase atomically. */
export interface AvailabilityCompletionIntegration {
  afterTechnicalCompletion(
    receipt: import('../maintenance/MaintenanceLifecycleContracts').TechnicalCompletionReceipt,
  ): Promise<void>;
}

/** DTO conversion only: does not complete a maintenance or authenticate the receipt. */
export function completionDisposalRequest(
  receipt: TechnicalCompletionReceipt,
): AvailabilityDisposal {
  assertIdentifier(receipt.congregationId);
  assertIdentifier(receipt.occurrenceId);
  assertVersion(receipt.sourceVersion);
  instant(receipt.completedAt);
  return Object.freeze({
    congregationId: receipt.congregationId,
    occurrenceId: receipt.occurrenceId,
    sourceVersion: receipt.sourceVersion,
    effectiveAt: receipt.completedAt,
    terminal: 'completed',
  });
}
