import {
  assertRange,
  freezePattern,
  freezeSchedule,
  generateRecurrenceSlots,
  parseDate,
} from './Calendar';
import type { DateRange, RecurrenceSlot } from './Calendar';
import { MaintenanceError } from './MaintenanceError';
import {
  assertCategory,
  assertIdentifier,
  assertVersion,
  freezeConfiguration,
} from './MaintenanceTypes';
import type {
  MaintenanceCategory,
  MaintenanceConfiguration,
  RecurrencePattern,
} from './MaintenanceTypes';

export interface RecurrenceSettings {
  readonly category: MaintenanceCategory;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly time: string;
  readonly timeZone: string;
  readonly pattern: RecurrencePattern;
  readonly defaults: MaintenanceConfiguration;
}
export interface RecurrenceRevisionSettings extends RecurrenceSettings {
  readonly effectiveFrom: string;
}
export interface RecurrenceRevision extends RecurrenceRevisionSettings {
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly version: number;
}
export interface RecurrenceRuleRecord {
  readonly id: string;
  readonly congregationId: string;
  readonly version: number;
  readonly revisions: readonly RecurrenceRevision[];
}
export interface ApprovedRecurrenceSlot extends RecurrenceSlot {
  readonly revision: RecurrenceRevision;
}
export interface NewRecurrenceRule extends RecurrenceSettings {
  readonly id: string;
  readonly congregationId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

function freezeRevision(input: RecurrenceRevision): RecurrenceRevision {
  assertIdentifier(input.approvedBy);
  assertVersion(input.version);
  assertCategory(input.category);
  parseDate(input.startsOn);
  parseDate(input.effectiveFrom);
  if (input.effectiveFrom < input.startsOn)
    throw new MaintenanceError('INVALID_REVISION_EFFECTIVE_DATE');
  if (input.endsOn !== null) {
    parseDate(input.endsOn);
    if (input.endsOn < input.startsOn)
      throw new MaintenanceError('INVALID_RANGE');
  }
  const schedule = freezeSchedule({
    date: input.startsOn,
    time: input.time,
    timeZone: input.timeZone,
  });
  if (!Number.isFinite(Date.parse(input.approvedAt)))
    throw new MaintenanceError('INVALID_DATE');
  return Object.freeze({
    category: input.category,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    time: schedule.time,
    timeZone: schedule.timeZone,
    pattern: freezePattern(input.category, input.pattern),
    defaults: freezeConfiguration(input.defaults),
    effectiveFrom: input.effectiveFrom,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    version: input.version,
  });
}

export class RecurrenceRule {
  private readonly record: RecurrenceRuleRecord;
  readonly latestRevision: RecurrenceRevision;

  private constructor(record: RecurrenceRuleRecord) {
    [record.id, record.congregationId].forEach(assertIdentifier);
    assertVersion(record.version);
    if (
      !Array.isArray(record.revisions) ||
      record.revisions.length !== record.version
    )
      throw new MaintenanceError('INVALID_VERSION');
    const revisions = record.revisions.map(freezeRevision);
    const first = revisions[0];
    const latest = revisions.at(-1);
    if (!first || !latest) throw new MaintenanceError('INVALID_VERSION');
    if (first.effectiveFrom !== first.startsOn)
      throw new MaintenanceError('INVALID_REVISION_EFFECTIVE_DATE');
    for (const [index, revision] of revisions.entries()) {
      if (revision.version !== index + 1)
        throw new MaintenanceError('INVALID_VERSION');
      if (
        revision.category !== first.category ||
        revision.startsOn !== first.startsOn
      )
        throw new MaintenanceError('RECURRENCE_IDENTITY_CHANGE');
      const previous = revisions[index - 1];
      if (previous && revision.effectiveFrom < previous.effectiveFrom)
        throw new MaintenanceError('INVALID_REVISION_EFFECTIVE_DATE');
    }
    this.record = Object.freeze({
      id: record.id,
      congregationId: record.congregationId,
      version: record.version,
      revisions: Object.freeze(revisions),
    });
    this.latestRevision = latest;
    Object.freeze(this);
  }
  static approve(input: NewRecurrenceRule): RecurrenceRule {
    return new RecurrenceRule({
      id: input.id,
      congregationId: input.congregationId,
      version: 1,
      revisions: [{ ...input, effectiveFrom: input.startsOn, version: 1 }],
    });
  }
  static restore(input: RecurrenceRuleRecord): RecurrenceRule {
    return new RecurrenceRule(input);
  }
  get id(): string {
    return this.record.id;
  }
  get congregationId(): string {
    return this.record.congregationId;
  }
  get version(): number {
    return this.record.version;
  }
  toRecord(): RecurrenceRuleRecord {
    return this.record;
  }
  revise(
    settings: RecurrenceRevisionSettings,
    approvedBy: string,
    approvedAt: string,
  ): RecurrenceRule {
    return new RecurrenceRule({
      id: this.id,
      congregationId: this.congregationId,
      version: this.version + 1,
      revisions: [
        ...this.record.revisions,
        { ...settings, approvedBy, approvedAt, version: this.version + 1 },
      ],
    });
  }
  slots(range: DateRange): readonly ApprovedRecurrenceSlot[] {
    assertRange(range);
    const slots: ApprovedRecurrenceSlot[] = [];
    for (const revision of this.record.revisions) {
      for (const slot of generateRecurrenceSlots(revision, range)) {
        // Select by stable cycle reference, never by a revised execution date.
        let applicable = this.record.revisions[0];
        for (const candidate of this.record.revisions) {
          if (candidate.effectiveFrom <= slot.cycleDate) applicable = candidate;
        }
        if (applicable === revision)
          slots.push(Object.freeze({ ...slot, revision }));
      }
    }
    return Object.freeze(slots.sort((a, b) => a.date.localeCompare(b.date)));
  }
}
