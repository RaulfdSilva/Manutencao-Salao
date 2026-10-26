import {
  assertCategory,
  assertIdentifier,
  assertVersion,
} from '../maintenance/MaintenanceTypes';
import type { MaintenanceCategory } from '../maintenance/MaintenanceTypes';
import { instant } from '../availability/AvailabilityPlan';
import { ChecklistError } from './ChecklistError';
import {
  freezeDefinition,
  freezeResult,
  text,
  unfilledResult,
  verificationKey,
} from './ChecklistTypes';
import type {
  VerificationDefinition,
  VerificationResult,
  VerificationStatus,
} from './ChecklistTypes';
import type { ChecklistTemplate } from './ChecklistTemplate';
export interface Verification {
  readonly key: string;
  readonly definition: VerificationDefinition;
  readonly origin: 'recurring' | 'occasional';
  readonly result: VerificationResult;
  readonly problemIds: readonly string[];
}
export interface ChecklistCorrection {
  readonly id: string;
  readonly recordedAt: string;
  readonly nature: string;
  readonly before: Verification;
  readonly after: Verification;
}
export interface ChecklistSummary {
  readonly counts: Readonly<Record<VerificationStatus, number>>;
  readonly unfilledKeys: readonly string[];
}
export interface MaintenanceChecklistRecord {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly category: MaintenanceCategory;
  readonly templateVersion: number;
  readonly version: number;
  readonly verifications: readonly Verification[];
  readonly completion: {
    readonly completedAt: string;
    readonly snapshot: readonly Verification[];
  } | null;
  readonly corrections: readonly ChecklistCorrection[];
}
function freezeVerification(input: Verification): Verification {
  const definition = freezeDefinition(input.definition),
    key = verificationKey(definition.taskId, definition.equipmentCategoryId);
  if (input.key !== key || !['recurring', 'occasional'].includes(input.origin))
    throw new ChecklistError('INVALID_RESULT');
  const problemIds = [...input.problemIds];
  problemIds.forEach(assertIdentifier);
  if (new Set(problemIds).size !== problemIds.length)
    throw new ChecklistError('INVALID_PROBLEM_LINK');
  const result = freezeResult(input.result);
  if (result.problemId !== null && !problemIds.includes(result.problemId))
    throw new ChecklistError('INVALID_PROBLEM_LINK');
  return Object.freeze({
    key,
    definition,
    origin: input.origin,
    result,
    problemIds: Object.freeze(problemIds),
  });
}
function freezeVerifications(
  inputs: readonly Verification[],
): readonly Verification[] {
  const entries = inputs.map(freezeVerification);
  if (new Set(entries.map((e) => e.key)).size !== entries.length)
    throw new ChecklistError('DUPLICATE_VERIFICATION');
  return Object.freeze(entries);
}
export class MaintenanceChecklist {
  private readonly record: MaintenanceChecklistRecord;
  private constructor(record: MaintenanceChecklistRecord) {
    [record.congregationId, record.occurrenceId].forEach(assertIdentifier);
    [record.version, record.templateVersion].forEach(assertVersion);
    assertCategory(record.category);
    let completion: MaintenanceChecklistRecord['completion'] = null;
    if (record.completion !== null) {
      instant(record.completion.completedAt);
      completion = Object.freeze({
        completedAt: record.completion.completedAt,
        snapshot: freezeVerifications(record.completion.snapshot),
      });
    }
    const corrections = record.corrections.map((c) => {
      assertIdentifier(c.id);
      instant(c.recordedAt);
      const before = freezeVerification(c.before),
        after = freezeVerification(c.after);
      if (before.key !== after.key || completion === null)
        throw new ChecklistError('INVALID_RESULT');
      return Object.freeze({
        id: c.id,
        recordedAt: c.recordedAt,
        nature: text(c.nature),
        before,
        after,
      });
    });
    this.record = Object.freeze({
      congregationId: record.congregationId,
      occurrenceId: record.occurrenceId,
      category: record.category,
      templateVersion: record.templateVersion,
      version: record.version,
      verifications: freezeVerifications(record.verifications),
      completion,
      corrections: Object.freeze(corrections),
    });
    Object.freeze(this);
  }
  static create(
    occurrenceId: string,
    template: ChecklistTemplate,
  ): MaintenanceChecklist {
    const source = template.toRecord();
    return new MaintenanceChecklist({
      congregationId: source.congregationId,
      occurrenceId,
      category: source.category,
      templateVersion: source.version,
      version: 1,
      completion: null,
      corrections: [],
      verifications: source.definitions.map((definition) => ({
        key: verificationKey(definition.taskId, definition.equipmentCategoryId),
        definition,
        origin: 'recurring',
        result: unfilledResult,
        problemIds: [],
      })),
    });
  }
  static restore(record: MaintenanceChecklistRecord): MaintenanceChecklist {
    return new MaintenanceChecklist(record);
  }
  toRecord(): MaintenanceChecklistRecord {
    return this.record;
  }
  verification(key: string): Verification {
    const entry = this.record.verifications.find((v) => v.key === key);
    if (!entry) throw new ChecklistError('VERIFICATION_NOT_FOUND');
    return entry;
  }
  addOccasional(definition: VerificationDefinition): MaintenanceChecklist {
    if (this.record.completion !== null)
      throw new ChecklistError('CHECKLIST_SEALED');
    const next = freezeDefinition(definition),
      key = verificationKey(next.taskId, next.equipmentCategoryId);
    if (this.record.verifications.some((v) => v.key === key))
      throw new ChecklistError('DUPLICATE_VERIFICATION');
    return this.evolve({
      verifications: [
        ...this.record.verifications,
        {
          key,
          definition: next,
          origin: 'occasional',
          result: unfilledResult,
          problemIds: [],
        },
      ],
    });
  }
  recordResult(key: string, result: VerificationResult): MaintenanceChecklist {
    if (this.record.completion !== null)
      throw new ChecklistError('CHECKLIST_SEALED');
    return this.replace(key, result);
  }
  seal(now: string): MaintenanceChecklist {
    instant(now);
    if (this.record.completion !== null)
      throw new ChecklistError('CHECKLIST_SEALED');
    return this.evolve({
      completion: { completedAt: now, snapshot: this.record.verifications },
    });
  }
  correct(
    key: string,
    result: VerificationResult,
    id: string,
    nature: string,
    now: string,
  ): MaintenanceChecklist {
    if (this.record.completion === null)
      throw new ChecklistError('CORRECTION_REQUIRES_COMPLETION');
    assertIdentifier(id);
    instant(now);
    const description = text(nature),
      before = this.verification(key);
    const next = this.replace(key, result);
    if (next === this) return this;
    return new MaintenanceChecklist({
      ...next.record,
      corrections: [
        ...this.record.corrections,
        {
          id,
          recordedAt: now,
          nature: description,
          before,
          after: next.verification(key),
        },
      ],
    });
  }
  summary(): ChecklistSummary {
    const counts: Record<VerificationStatus, number> = {
      unfilled: 0,
      completed: 0,
      problem_found: 0,
      not_applicable: 0,
    };
    for (const entry of this.record.verifications)
      counts[entry.result.status]++;
    return Object.freeze({
      counts: Object.freeze(counts),
      unfilledKeys: Object.freeze(
        this.record.verifications
          .filter((v) => v.result.status === 'unfilled')
          .map((v) => v.key),
      ),
    });
  }
  private replace(
    key: string,
    input: VerificationResult,
  ): MaintenanceChecklist {
    const previous = this.verification(key),
      result = freezeResult(input);
    if (JSON.stringify(result) === JSON.stringify(previous.result)) return this;
    const problemIds =
      result.problemId === null ||
      previous.problemIds.includes(result.problemId)
        ? previous.problemIds
        : [...previous.problemIds, result.problemId];
    const after = { ...previous, result, problemIds };
    return this.evolve({
      verifications: this.record.verifications.map((v) =>
        v.key === key ? after : v,
      ),
    });
  }
  private evolve(
    changes: Partial<
      Pick<MaintenanceChecklistRecord, 'verifications' | 'completion'>
    >,
  ): MaintenanceChecklist {
    return new MaintenanceChecklist({
      ...this.record,
      ...changes,
      version: this.record.version + 1,
    });
  }
}
