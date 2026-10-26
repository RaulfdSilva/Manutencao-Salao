import { describe, expect, it } from 'vitest';
import { recurrenceCycle } from '../../src/domain/maintenance/Calendar';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import { RecurrenceRule } from '../../src/domain/maintenance/RecurrenceRule';
import type {
  RecurrenceRevisionSettings,
  RecurrenceSettings,
} from '../../src/domain/maintenance/RecurrenceRule';
import { now, settings } from './MaintenanceTestEnvironment';

function approve(changes: Partial<RecurrenceSettings> = {}): RecurrenceRule {
  return RecurrenceRule.approve({
    ...settings,
    ...changes,
    id: 'rule',
    congregationId: 'congregation',
    approvedBy: 'admin',
    approvedAt: now,
  });
}
const november = { from: '2026-11-01', to: '2026-11-30' };

function revise(
  rule: RecurrenceRule,
  changes: Partial<RecurrenceRevisionSettings> = {},
): RecurrenceRule {
  return rule.revise(
    { ...rule.latestRevision, effectiveFrom: '2026-11-01', ...changes },
    'admin',
    now,
  );
}

describe('stable recurrence cycles and revision history', () => {
  it('keeps the same weekend keys for Saturday and Sunday and different keys for first/third weekends', () => {
    const saturday = approve();
    const sunday = revise(saturday, {
      pattern: { kind: 'weekends', day: 'sunday' },
    });
    const before = saturday.slots(november);
    const after = sunday.slots(november);
    expect(after.map((s) => s.cycleKey)).toEqual(before.map((s) => s.cycleKey));
    expect(after.map((s) => [s.cycleDate, s.date])).toEqual([
      ['2026-11-07', '2026-11-08'],
      ['2026-11-21', '2026-11-22'],
    ]);
    expect(new Set(after.map((s) => s.cycleKey)).size).toBe(2);
  });

  it.each(['monthly', 'quarterly', 'semiannual'] as const)(
    'keeps %s cycle identity when execution day and overflow policy change',
    (category) => {
      const original = approve({
        category,
        pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
      });
      const revised = revise(original, {
        effectiveFrom: '2026-01-01',
        pattern: { kind: 'months', dayOfMonth: 15, overflow: 'skip' },
      });
      const range = { from: '2026-01-01', to: '2026-12-31' };
      const before = original.slots(range),
        after = revised.slots(range);
      expect(after.map((s) => s.cycleKey)).toEqual(
        before.map((s) => s.cycleKey),
      );
      expect(after.every((s) => s.date.endsWith('-15'))).toBe(true);
      expect(after.every((s) => s.revision.version === 2)).toBe(true);
    },
  );

  it('selects historical settings on either side of an explicit effective cycle across a year boundary', () => {
    const original = approve();
    const revision2 = revise(original, {
      effectiveFrom: '2026-12-01',
      time: '10:00',
    });
    const revision3 = revise(revision2, {
      effectiveFrom: '2027-01-01',
      time: '11:00',
    });
    const slots = revision3.slots({ from: '2026-11-01', to: '2027-01-31' });
    expect(
      slots.map((s) => [s.date, s.revision.time, s.revision.version]),
    ).toEqual([
      ['2026-11-07', '09:00', 1],
      ['2026-11-21', '09:00', 1],
      ['2026-12-05', '10:00', 2],
      ['2026-12-19', '10:00', 2],
      ['2027-01-02', '11:00', 3],
      ['2027-01-16', '11:00', 3],
    ]);
    expect(original.toRecord().revisions).toHaveLength(1);
    expect(revision3.toRecord().revisions).toHaveLength(3);
    expect(Object.isFrozen(revision3.toRecord().revisions)).toBe(true);
    expect(Object.isFrozen(revision3.latestRevision.defaults)).toBe(true);
    expect(
      RecurrenceRule.restore(revision3.toRecord()).slots({
        from: '2026-11-01',
        to: '2027-01-31',
      }),
    ).toEqual(slots);
  });

  it.each([
    ['fortnightly', '2026-11-08', '2026-11-07', '2026-11-21'],
    ['monthly', '2026-11-15', '2026-11-20', '2026-12-20'],
  ] as const)(
    'applies mid-cycle effective dates to the next cycle for %s',
    (category, effectiveFrom, oldDate, newDate) => {
      const original = approve({
        category,
        pattern:
          category === 'fortnightly'
            ? { kind: 'weekends', day: 'saturday' }
            : { kind: 'months', dayOfMonth: 20, overflow: 'skip' },
      });
      const revised = revise(original, { effectiveFrom, time: '10:00' });
      const slots = revised.slots({ from: '2026-11-01', to: '2026-12-31' });
      expect(slots.find((s) => s.date === oldDate)?.revision.version).toBe(1);
      expect(slots.find((s) => s.date === newDate)?.revision.version).toBe(2);
    },
  );

  it('covers the first partial cycle and does not silently apply a mid-month revision backwards', () => {
    const original = approve({
      category: 'monthly',
      startsOn: '2026-01-15',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
    });
    const revised = revise(original, {
      effectiveFrom: '2026-01-20',
      pattern: { kind: 'months', dayOfMonth: 25, overflow: 'last_day' },
    });
    expect(
      revised
        .slots({ from: '2026-01-01', to: '2026-02-28' })
        .map((s) => [s.date, s.revision.version]),
    ).toEqual([
      ['2026-01-31', 1],
      ['2026-02-25', 2],
    ]);
  });

  it('permits the latest approved revision to supersede the same effective date without losing prior approval', () => {
    const second = revise(approve(), { time: '10:00' });
    const third = revise(second, { time: '11:00' });
    expect(third.slots(november).every((s) => s.revision.version === 3)).toBe(
      true,
    );
    expect(third.toRecord().revisions.map((r) => r.time)).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
  });

  it('can fill a previously skipped leap-month cycle using applicable revised settings', () => {
    const original = approve({
      category: 'monthly',
      startsOn: '2024-01-01',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'skip' },
    });
    const range = { from: '2024-02-01', to: '2024-02-29' };
    expect(original.slots(range)).toEqual([]);
    expect(
      revise(original, {
        effectiveFrom: '2024-02-01',
        pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
      }).slots(range),
    ).toMatchObject([{ date: '2024-02-29', cycleKey: 'month:2024-02' }]);
  });

  it('applies revised end dates only to unmaterialized cycles selected by their effective revision', () => {
    const original = approve();
    const revised = revise(original, {
      effectiveFrom: '2026-11-01',
      endsOn: '2026-11-07',
    });
    expect(
      revised
        .slots({ from: '2026-10-01', to: '2026-12-31' })
        .map((s) => s.date),
    ).toEqual(['2026-10-03', '2026-10-17', '2026-11-07']);
  });

  it.each(['2025-12-31', '2026-10-31'])(
    'rejects backward revision effectivity %s',
    (effectiveFrom) => {
      const current = revise(approve());
      expect(() => revise(current, { effectiveFrom })).toThrowError(
        new MaintenanceError('INVALID_REVISION_EFFECTIVE_DATE'),
      );
    },
  );

  it.each([undefined, '2026-02-30', ''])(
    'requires an explicit valid effective date: %s',
    (effectiveFrom) => {
      const input = {
        ...settings,
        effectiveFrom,
      } as RecurrenceRevisionSettings;
      expect(() => approve().revise(input, 'admin', now)).toThrowError(
        new MaintenanceError('INVALID_DATE'),
      );
    },
  );

  it.each([
    {
      category: 'monthly',
      pattern: { kind: 'months', dayOfMonth: 7, overflow: 'skip' },
    },
    { startsOn: '2026-02-01' },
  ] as const)(
    'rejects changing cycle identity inside a rule: %j',
    (changes) => {
      expect(() => revise(approve(), changes)).toThrowError(
        new MaintenanceError('RECURRENCE_IDENTITY_CHANGE'),
      );
    },
  );

  it('requires complete validated history during rehydration and rejects version mismatches', () => {
    const original = approve().toRecord();
    expect(() =>
      RecurrenceRule.restore({ ...original, version: 2 }),
    ).toThrowError(new MaintenanceError('INVALID_VERSION'));
    expect(() =>
      RecurrenceRule.restore({ ...original, revisions: [] }),
    ).toThrowError(new MaintenanceError('INVALID_VERSION'));
    const initial = original.revisions[0];
    if (!initial) throw new Error('Missing revision fixture');
    expect(() =>
      RecurrenceRule.restore({
        ...original,
        revisions: [{ ...initial, effectiveFrom: '2026-02-01' }],
      }),
    ).toThrowError(new MaintenanceError('INVALID_REVISION_EFFECTIVE_DATE'));
  });

  it('does not infer missing cycle identity or configuration version from legacy sources', () => {
    const slot = approve().slots(november)[0];
    if (!slot) throw new Error('Missing slot');
    const occurrence = MaintenanceOccurrence.create({
      id: 'occurrence',
      congregationId: 'congregation',
      category: 'fortnightly',
      schedule: { date: slot.date, time: '09:00', timeZone: 'UTC' },
      configuration: slot.revision.defaults,
      assignedMemberIds: [],
      source: {
        ruleId: 'rule',
        slotDate: slot.date,
        weekendStart: slot.weekendStart,
        cycleKey: slot.cycleKey,
        ruleVersion: 1,
      },
    }).toRecord();
    const { source } = occurrence;
    if (!source) throw new Error('Missing source');
    const missingKey = {
      ...source,
      cycleKey: undefined,
    } as unknown as NonNullable<typeof source>;
    const missingVersion = {
      ...source,
      ruleVersion: undefined,
    } as unknown as NonNullable<typeof source>;
    expect(() =>
      MaintenanceOccurrence.restore({ ...occurrence, source: missingKey }),
    ).toThrowError(new MaintenanceError('INVALID_CYCLE'));
    expect(() =>
      MaintenanceOccurrence.restore({ ...occurrence, source: missingVersion }),
    ).toThrowError(new MaintenanceError('INVALID_VERSION'));
  });

  it('validates canonical sources, keeps them after rescheduling and rejects forged cycle keys', () => {
    const slot = approve().slots(november)[0];
    if (!slot) throw new Error('Missing slot');
    const occurrence = MaintenanceOccurrence.create({
      id: 'occurrence',
      congregationId: 'congregation',
      category: 'fortnightly',
      schedule: { date: slot.date, time: '09:00', timeZone: 'UTC' },
      configuration: slot.revision.defaults,
      assignedMemberIds: [],
      source: {
        ruleId: 'rule',
        slotDate: slot.date,
        weekendStart: slot.weekendStart,
        cycleKey: slot.cycleKey,
        ruleVersion: 1,
      },
    });
    expect(
      occurrence
        .reschedule(
          { date: '2027-01-01', time: '09:00', timeZone: 'UTC' },
          'reconfirm',
        )
        .toRecord().source,
    ).toEqual(occurrence.toRecord().source);
    const source = occurrence.toRecord().source;
    if (!source) throw new Error('Missing source');
    expect(() =>
      MaintenanceOccurrence.restore({
        ...occurrence.toRecord(),
        source: { ...source, cycleKey: 'weekend:2026-11-21' },
      }),
    ).toThrowError(new MaintenanceError('INVALID_CYCLE'));
  });

  it.each([
    ['fortnightly', '2026-11-14', '2026-11-14'],
    ['fortnightly', '2026-11-09', '2026-11-07'],
    ['fortnightly', '2026-11-07', null],
    ['monthly', '2026-11-07', '2026-11-07'],
  ] as const)(
    'rejects invalid cycle references for %s %s %s',
    (category, date, weekendStart) => {
      expect(() => recurrenceCycle(category, date, weekendStart)).toThrowError(
        new MaintenanceError('INVALID_CYCLE'),
      );
    },
  );
});
