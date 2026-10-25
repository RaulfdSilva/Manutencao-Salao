import { MaintenanceError } from './MaintenanceError';
import { assertCategory } from './MaintenanceTypes';
import type {
  MaintenanceCategory,
  MaintenanceSchedule,
  RecurrencePattern,
} from './MaintenanceTypes';

const dayMilliseconds = 86_400_000;
export const maximumGenerationDays = 366;
export interface DateRange {
  readonly from: string;
  readonly to: string;
}
export interface RecurrenceSlot {
  readonly date: string;
  readonly weekendStart: string | null;
  readonly cycleKey: string;
  readonly cycleDate: string;
}

function utcDate(year: number, month: number, day: number): Date {
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
function formatDate(value: Date): string | null {
  const year = value.getUTCFullYear();
  return year < 1 || year > 9999 ? null : value.toISOString().slice(0, 10);
}
export function parseDate(value: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new MaintenanceError('INVALID_DATE');
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined)
    throw new MaintenanceError('INVALID_DATE');
  const result = utcDate(year, month, day);
  if (formatDate(result) !== value) throw new MaintenanceError('INVALID_DATE');
  return result;
}
export function assertRange(range: DateRange): void {
  const from = parseDate(range.from).getTime();
  const to = parseDate(range.to).getTime();
  if (to < from) throw new MaintenanceError('INVALID_RANGE');
  if ((to - from) / dayMilliseconds + 1 > maximumGenerationDays)
    throw new MaintenanceError('RANGE_TOO_LARGE');
}
export function freezeSchedule(
  schedule: MaintenanceSchedule,
): MaintenanceSchedule {
  parseDate(schedule.date);
  if (
    typeof schedule.time !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)
  )
    throw new MaintenanceError('INVALID_TIME');
  if (typeof schedule.timeZone !== 'string' || !schedule.timeZone.trim())
    throw new MaintenanceError('INVALID_TIME_ZONE');
  try {
    new Intl.DateTimeFormat('en', { timeZone: schedule.timeZone }).format(0);
  } catch {
    throw new MaintenanceError('INVALID_TIME_ZONE');
  }
  return Object.freeze({
    date: schedule.date,
    time: schedule.time,
    timeZone: schedule.timeZone,
  });
}
export function freezePattern(
  category: MaintenanceCategory,
  pattern: RecurrencePattern,
): RecurrencePattern {
  assertCategory(category);
  if (category === 'fortnightly') {
    if (
      pattern.kind !== 'weekends' ||
      !['saturday', 'sunday'].includes(pattern.day)
    )
      throw new MaintenanceError('INVALID_RECURRENCE');
    return Object.freeze({ kind: pattern.kind, day: pattern.day });
  }
  if (
    pattern.kind !== 'months' ||
    !Number.isInteger(pattern.dayOfMonth) ||
    pattern.dayOfMonth < 1 ||
    pattern.dayOfMonth > 31 ||
    !['skip', 'last_day'].includes(pattern.overflow)
  )
    throw new MaintenanceError('INVALID_RECURRENCE');
  return Object.freeze({
    kind: pattern.kind,
    dayOfMonth: pattern.dayOfMonth,
    overflow: pattern.overflow,
  });
}
function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** Canonical cycle identity, independent of execution day, revision or rescheduling. */
export function recurrenceCycle(
  category: MaintenanceCategory,
  slotDate: string,
  weekendStart: string | null,
): { readonly cycleKey: string; readonly cycleDate: string } {
  assertCategory(category);
  const date = parseDate(slotDate);
  if (category !== 'fortnightly') {
    if (weekendStart !== null) throw new MaintenanceError('INVALID_CYCLE');
    return Object.freeze({
      cycleKey: `month:${slotDate.slice(0, 7)}`,
      cycleDate: `${slotDate.slice(0, 7)}-01`,
    });
  }
  if (weekendStart === null) throw new MaintenanceError('INVALID_CYCLE');
  const saturday = parseDate(weekendStart);
  const ordinal = Math.floor((saturday.getUTCDate() - 1) / 7) + 1;
  const offset = (date.getTime() - saturday.getTime()) / dayMilliseconds;
  if (
    saturday.getUTCDay() !== 6 ||
    ![1, 3].includes(ordinal) ||
    ![0, 1].includes(offset)
  )
    throw new MaintenanceError('INVALID_CYCLE');
  return Object.freeze({
    cycleKey: `weekend:${weekendStart}`,
    cycleDate: weekendStart,
  });
}

/** Pure bounded generation, inclusive range; no dependence on system clock or host time zone. */
export function generateRecurrenceSlots(
  input: {
    readonly category: MaintenanceCategory;
    readonly pattern: RecurrencePattern;
    readonly startsOn: string;
    readonly endsOn: string | null;
  },
  range: DateRange,
): readonly RecurrenceSlot[] {
  assertCategory(input.category);
  assertRange(range);
  const pattern = freezePattern(input.category, input.pattern);
  const anchor = parseDate(input.startsOn);
  if (input.endsOn !== null) {
    parseDate(input.endsOn);
    if (input.endsOn < input.startsOn)
      throw new MaintenanceError('INVALID_RANGE');
  }
  const slots = new Map<string, RecurrenceSlot>();
  const add = (date: string | null, weekendStart: string | null) => {
    if (
      date &&
      date >= range.from &&
      date <= range.to &&
      date >= input.startsOn &&
      (input.endsOn === null || date <= input.endsOn)
    ) {
      slots.set(
        date,
        Object.freeze({
          date,
          weekendStart,
          ...recurrenceCycle(input.category, date, weekendStart),
        }),
      );
    }
  };
  // Include neighboring months before filtering the exact civil-date range.
  const fromMonth = Math.max(12, monthIndex(parseDate(range.from)) - 1);
  const toMonth = Math.min(119999, monthIndex(parseDate(range.to)) + 1);
  for (let index = fromMonth; index <= toMonth; index++) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    if (pattern.kind === 'weekends') {
      const firstDay = utcDate(year, month, 1).getUTCDay();
      const firstSaturday = 1 + ((6 - firstDay + 7) % 7);
      for (const offset of [0, 14]) {
        const start = utcDate(year, month, firstSaturday + offset);
        const date = utcDate(
          year,
          month,
          firstSaturday + offset + (pattern.day === 'sunday' ? 1 : 0),
        );
        add(formatDate(date), formatDate(start));
      }
    } else {
      const interval = {
        monthly: 1,
        quarterly: 3,
        semiannual: 6,
        fortnightly: 0,
      }[input.category];
      const delta = index - monthIndex(anchor);
      if (delta < 0 || delta % interval !== 0) continue;
      const lastDay = utcDate(year, month + 1, 0).getUTCDate();
      if (pattern.dayOfMonth > lastDay && pattern.overflow === 'skip') continue;
      add(
        formatDate(utcDate(year, month, Math.min(pattern.dayOfMonth, lastDay))),
        null,
      );
    }
  }
  return Object.freeze(
    [...slots.values()].sort((a, b) => a.date.localeCompare(b.date)),
  );
}
