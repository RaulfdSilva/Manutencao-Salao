import type { MemberRepository } from '../../domain/members/MemberRepository';
import type { OccurrenceRecord } from '../../domain/maintenance/MaintenanceOccurrence';
import type {
  OccurrenceRepository,
  RecurrenceRepository,
} from '../../domain/maintenance/MaintenanceRepository';
import type { AvailabilityDecision } from '../../domain/maintenance/MaintenanceTypes';
import type { RecurrenceRuleRecord } from '../../domain/maintenance/RecurrenceRule';

export interface MaintenanceEventEnvelope {
  readonly id: string;
  readonly congregationId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}
export type MaintenancePlanningEvent = MaintenanceEventEnvelope &
  (
    | {
        readonly kind: 'rule_approved' | 'rule_revised';
        readonly before: RecurrenceRuleRecord | null;
        readonly after: RecurrenceRuleRecord;
      }
    | {
        readonly kind:
          | 'occurrence_created'
          | 'occurrence_configured'
          | 'team_changed'
          | 'occurrence_cancelled';
        readonly before: OccurrenceRecord | null;
        readonly after: OccurrenceRecord;
        readonly invalidatesReminderVersionsThrough: number | null;
      }
    | {
        readonly kind: 'occurrence_rescheduled';
        readonly before: OccurrenceRecord;
        readonly after: OccurrenceRecord;
        readonly invalidatesReminderVersionsThrough: number;
        readonly availabilityDecision: AvailabilityDecision;
        readonly reconfirmationRecommended: boolean;
      }
  );
export interface MaintenanceUnitOfWork {
  readonly members: Pick<MemberRepository, 'findById'>;
  readonly rules: RecurrenceRepository;
  readonly occurrences: OccurrenceRepository;
  /** Durable audit/outbox, atomically persisted with records. No real delivery here. */
  readonly events: { append(event: MaintenancePlanningEvent): Promise<void> };
}
export interface MaintenanceTransactions {
  /**
   * Trusted server boundary. Serialize by congregation, including member/role
   * reads, rule revision and unique cycle insertion. Roll back records AND events on failure.
   * Must share the server transaction with member deactivation/assignment removal.
   */
  run<T>(
    congregationId: string,
    work: (tx: MaintenanceUnitOfWork) => Promise<T>,
  ): Promise<T>;
}
export interface MaintenanceDependencies {
  readonly transactions: MaintenanceTransactions;
  readonly ids: { next(): string };
  readonly clock: { now(): string };
}
/** Normalized internal contract only, NOT a claim about an Hourglass API/file format. */
export interface AudioTeamSchedule {
  membersForWeekend(input: {
    readonly congregationId: string;
    readonly weekendStart: string;
  }): Promise<readonly string[]>;
}
