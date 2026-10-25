import type { DateRange } from './Calendar';
import type { MaintenanceOccurrence } from './MaintenanceOccurrence';
import type { RecurrenceRule } from './RecurrenceRule';

export interface RecurrenceRepository {
  findById(
    congregationId: string,
    ruleId: string,
  ): Promise<RecurrenceRule | null>;
  insert(rule: RecurrenceRule): Promise<void>;
  /** Atomic scoped CAS; next version must be expectedVersion + 1. */
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
  /** Filter by current scheduled civil date, including cancelled records for history. */
  list(
    congregationId: string,
    range: DateRange,
  ): Promise<readonly MaintenanceOccurrence[]>;
  insert(occurrence: MaintenanceOccurrence): Promise<void>;
  /**
   * Atomically enforce unique (congregationId, source.ruleId, source.slotDate).
   * Return the EXISTING record unchanged if the slot exists, even if rescheduled
   * or cancelled. Identifier collisions with other sources must be errors.
   */
  insertGeneratedIfAbsent(occurrence: MaintenanceOccurrence): Promise<{
    readonly inserted: boolean;
    readonly occurrence: MaintenanceOccurrence;
  }>;
  /** Atomic id/congregation/version CAS, no writes on false; same transaction as events. */
  saveIfVersion(
    occurrence: MaintenanceOccurrence,
    expectedVersion: number,
  ): Promise<boolean>;
}
