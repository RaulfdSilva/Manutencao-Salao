import type { DateRange } from './Calendar';
import type { MaintenanceOccurrence } from './MaintenanceOccurrence';
import type { RecurrenceRule } from './RecurrenceRule';

export interface RecurrenceRepository {
  findById(
    congregationId: string,
    ruleId: string,
  ): Promise<RecurrenceRule | null>;
  insert(rule: RecurrenceRule): Promise<void>;
  /** Atomic scoped CAS; next = expected + 1, append-only revision history with immutable identity/anchor. */
  saveIfVersion(
    rule: RecurrenceRule,
    expectedVersion: number,
  ): Promise<boolean>;
}
export interface OccurrenceRepository {
  findById(
    congregationId: string,
    occurrenceId: string,
  ): Promise<MaintenanceOccurrence | null>;
  /** Filter by current scheduled civil date, including cancelled/completed records for history. */
  list(
    congregationId: string,
    range: DateRange,
  ): Promise<readonly MaintenanceOccurrence[]>;
  /** Manual occurrences only (source = null); generated records use the atomic cycle operation. */
  insert(occurrence: MaintenanceOccurrence): Promise<void>;
  /**
   * Atomically enforce unique (congregationId, source.ruleId, source.cycleKey).
   * Return the EXISTING record unchanged if the cycle exists, even if rescheduled
   * or cancelled/completed. Identifier collisions with other sources must be errors.
   */
  insertGeneratedIfAbsent(occurrence: MaintenanceOccurrence): Promise<{
    readonly inserted: boolean;
    readonly occurrence: MaintenanceOccurrence;
  }>;
  /** Atomic scoped CAS; immutable source/id, next version = expected + 1, no writes on false; same transaction as events. */
  saveIfVersion(
    occurrence: MaintenanceOccurrence,
    expectedVersion: number,
  ): Promise<boolean>;
}
