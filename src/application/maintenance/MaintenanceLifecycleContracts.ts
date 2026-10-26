import type { OccurrenceRecord } from '../../domain/maintenance/MaintenanceOccurrence';
import type {
  MaintenanceCategory,
  MaintenanceSchedule,
} from '../../domain/maintenance/MaintenanceTypes';
import { assertVersion } from '../../domain/maintenance/MaintenanceTypes';
import { instant } from '../../domain/availability/AvailabilityPlan';
import { AvailabilityError } from '../../domain/availability/AvailabilityError';

export type ResponseDeadlineDecision =
  | { readonly kind: 'keep'; readonly expectedVersion: number | null }
  | {
      readonly kind: 'replace';
      readonly deadline: string;
      readonly expectedVersion: number | null;
    };
export function assertDeadlineDecision(
  decision: ResponseDeadlineDecision,
): void {
  if (!decision || !['keep', 'replace'].includes(decision.kind))
    throw new AvailabilityError('INVALID_DEADLINE_DECISION');
  if (decision.expectedVersion !== null)
    assertVersion(decision.expectedVersion);
  if (decision.kind === 'replace') instant(decision.deadline);
}
export interface AvailabilityReschedule {
  readonly before: OccurrenceRecord;
  readonly after: OccurrenceRecord;
  readonly deadlineDecision: ResponseDeadlineDecision;
  readonly actorId: string;
  readonly occurredAt: string;
}
/** Whitelist for durable operational history. No members, answers or invitation counts. */
export interface MaintenanceTechnicalSnapshot {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly version: number;
  readonly observedAt: string;
  readonly category: MaintenanceCategory;
  readonly schedule: MaintenanceSchedule;
  readonly status: 'scheduled' | 'cancelled';
  readonly source: {
    readonly ruleId: string;
    readonly cycleKey: string;
  } | null;
}
export function technicalSnapshot(
  record: OccurrenceRecord,
  observedAt: string,
): MaintenanceTechnicalSnapshot {
  instant(observedAt);
  return Object.freeze({
    observedAt,
    congregationId: record.congregationId,
    occurrenceId: record.id,
    version: record.version,
    category: record.category,
    schedule: Object.freeze({
      date: record.schedule.date,
      time: record.schedule.time,
      timeZone: record.schedule.timeZone,
    }),
    status: record.status,
    source: record.source
      ? Object.freeze({
          ruleId: record.source.ruleId,
          cycleKey: record.source.cycleKey,
        })
      : null,
  });
}
export interface TechnicalMaintenanceHistory {
  /** Scoped idempotent upsert by occurrence/version, keeping first schedule and subsequent technical changes. Never append member snapshots. */
  record(snapshot: MaintenanceTechnicalSnapshot): Promise<void>;
}
/** Future completion module must persist/authorize real technical completion first, in the SAME transaction. Not a completion use case or credential. */
export interface TechnicalCompletionReceipt {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly sourceVersion: number;
  readonly completedAt: string;
}
export interface AnnualMaintenanceRecord {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly category: MaintenanceCategory;
  readonly firstScheduled: MaintenanceSchedule;
  readonly latestScheduled: MaintenanceSchedule;
  readonly status: 'scheduled' | 'completed' | 'cancelled';
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly sourceVersion: number;
}

/** Storage contract only: no annual dashboard or technical completion implemented here. */
export interface AnnualMaintenanceHistory extends TechnicalMaintenanceHistory {
  find(
    congregationId: string,
    occurrenceId: string,
  ): Promise<AnnualMaintenanceRecord | null>;
  /** Verify the real completion in the server transaction; never infer completion from availability. */
  recordCompletion(receipt: TechnicalCompletionReceipt): Promise<void>;
}
