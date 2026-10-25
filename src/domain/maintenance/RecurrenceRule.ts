import {
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
export interface RecurrenceRuleRecord extends RecurrenceSettings {
  readonly id: string;
  readonly congregationId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly version: number;
}
export class RecurrenceRule {
  private readonly record: RecurrenceRuleRecord;
  private constructor(record: RecurrenceRuleRecord) {
    [record.id, record.congregationId, record.approvedBy].forEach(
      assertIdentifier,
    );
    assertVersion(record.version);
    assertCategory(record.category);
    parseDate(record.startsOn);
    if (record.endsOn !== null) {
      parseDate(record.endsOn);
      if (record.endsOn < record.startsOn)
        throw new MaintenanceError('INVALID_RANGE');
    }
    const schedule = freezeSchedule({
      date: record.startsOn,
      time: record.time,
      timeZone: record.timeZone,
    });
    if (!Number.isFinite(Date.parse(record.approvedAt)))
      throw new MaintenanceError('INVALID_DATE');
    this.record = Object.freeze({
      id: record.id,
      congregationId: record.congregationId,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
      version: record.version,
      category: record.category,
      startsOn: record.startsOn,
      endsOn: record.endsOn,
      time: schedule.time,
      timeZone: schedule.timeZone,
      pattern: freezePattern(record.category, record.pattern),
      defaults: freezeConfiguration(record.defaults),
    });
    Object.freeze(this);
  }
  static approve(input: Omit<RecurrenceRuleRecord, 'version'>): RecurrenceRule {
    return new RecurrenceRule({ ...input, version: 1 });
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
    settings: RecurrenceSettings,
    approvedBy: string,
    approvedAt: string,
  ): RecurrenceRule {
    return new RecurrenceRule({
      ...settings,
      id: this.id,
      congregationId: this.congregationId,
      approvedBy,
      approvedAt,
      version: this.version + 1,
    });
  }
  slots(range: DateRange): readonly RecurrenceSlot[] {
    return generateRecurrenceSlots(this.record, range);
  }
}
