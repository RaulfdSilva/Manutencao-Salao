import { ChecklistError } from './ChecklistError';
import {
  assertIdentifier,
  assertVersion,
} from '../maintenance/MaintenanceTypes';
import { instant } from '../availability/AvailabilityPlan';
import { text } from './ChecklistTypes';
export interface TechnicalProblemRecord {
  readonly id: string;
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly verificationKey: string;
  readonly description: string;
  readonly photoReference: string | null;
  readonly status: 'pending' | 'resolved';
  readonly recordedAt: string;
  readonly resolvedAt: string | null;
  readonly version: number;
}
export class TechnicalProblem {
  private readonly record: TechnicalProblemRecord;
  private constructor(record: TechnicalProblemRecord) {
    [
      record.id,
      record.congregationId,
      record.occurrenceId,
      record.verificationKey,
    ].forEach(assertIdentifier);
    assertVersion(record.version);
    instant(record.recordedAt);
    if (record.photoReference !== null) assertIdentifier(record.photoReference);
    if (
      !['pending', 'resolved'].includes(record.status) ||
      (record.status === 'pending') !== (record.resolvedAt === null)
    )
      throw new ChecklistError('INVALID_PROBLEM_STATE');
    if (record.resolvedAt !== null) instant(record.resolvedAt);
    this.record = Object.freeze({
      id: record.id,
      congregationId: record.congregationId,
      occurrenceId: record.occurrenceId,
      verificationKey: record.verificationKey,
      description: text(record.description),
      photoReference: record.photoReference,
      status: record.status,
      recordedAt: record.recordedAt,
      resolvedAt: record.resolvedAt,
      version: record.version,
    });
    Object.freeze(this);
  }
  static create(
    input: Omit<TechnicalProblemRecord, 'status' | 'resolvedAt' | 'version'>,
  ): TechnicalProblem {
    return new TechnicalProblem({
      ...input,
      status: 'pending',
      resolvedAt: null,
      version: 1,
    });
  }
  static restore(record: TechnicalProblemRecord): TechnicalProblem {
    return new TechnicalProblem(record);
  }
  toRecord(): TechnicalProblemRecord {
    return this.record;
  }
  resolve(now: string): TechnicalProblem {
    instant(now);
    return this.record.status === 'resolved'
      ? this
      : new TechnicalProblem({
          ...this.record,
          status: 'resolved',
          resolvedAt: now,
          version: this.record.version + 1,
        });
  }
}
