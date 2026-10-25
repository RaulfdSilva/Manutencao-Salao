import { describe, expect, it } from 'vitest';
import { assertRange, parseDate } from '../../src/domain/maintenance/Calendar';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import type {
  MaintenanceCategory,
  RecurrencePattern,
} from '../../src/domain/maintenance/MaintenanceTypes';
import { RecurrenceRule } from '../../src/domain/maintenance/RecurrenceRule';
import type { RecurrenceSettings } from '../../src/domain/maintenance/RecurrenceRule';
import { now, settings } from './MaintenanceTestEnvironment';

function rule(changes: Partial<RecurrenceSettings> = {}): RecurrenceRule {
  return RecurrenceRule.approve({
    ...settings,
    ...changes,
    id: 'rule',
    congregationId: 'congregation',
    approvedBy: 'admin',
    approvedAt: now,
  });
}
function dates(
  current: RecurrenceRule,
  from: string,
  to: string,
): readonly string[] {
  return current.slots({ from, to }).map((slot) => slot.date);
}

describe('recurrence calendar', () => {
  it.each([
    ['2026-08-01', '2026-08-31', ['2026-08-01', '2026-08-15']],
    ['2026-11-01', '2026-11-30', ['2026-11-07', '2026-11-21']],
    [
      '2026-12-01',
      '2027-01-31',
      ['2026-12-05', '2026-12-19', '2027-01-02', '2027-01-16'],
    ],
  ] as const)(
    'generates first/third Saturdays in %s through %s',
    (from, to, expected) => {
      expect(dates(rule(), from, to)).toEqual(expected);
    },
  );

  it('uses Saturday to count weekends when the month starts on Sunday', () => {
    const current = rule({ pattern: { kind: 'weekends', day: 'sunday' } });
    expect(dates(current, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-08',
      '2026-11-22',
    ]);
    expect(
      current
        .slots({ from: '2026-11-01', to: '2026-11-30' })
        .map((slot) => slot.weekendStart),
    ).toEqual(['2026-11-07', '2026-11-21']);
    expect(dates(current, '2026-01-31', '2026-02-01')).toEqual([]);
  });

  it('generates the same sorted unique slots for repeated and overlapping ranges', () => {
    const current = rule();
    const first = current.slots({ from: '2026-11-01', to: '2026-12-31' });
    expect(current.slots({ from: '2026-11-01', to: '2026-12-31' })).toEqual(
      first,
    );
    expect(new Set(first.map((slot) => slot.date)).size).toBe(first.length);
    expect(dates(current, '2026-11-20', '2026-12-10')).toEqual([
      '2026-11-21',
      '2026-12-05',
    ]);
  });

  it.each(['skip', 'last_day'] as const)(
    'applies explicit month overflow policy %s',
    (overflow) => {
      const current = rule({
        category: 'monthly',
        pattern: { kind: 'months', dayOfMonth: 31, overflow },
      });
      expect(dates(current, '2026-01-01', '2026-03-31')).toEqual(
        overflow === 'skip'
          ? ['2026-01-31', '2026-03-31']
          : ['2026-01-31', '2026-02-28', '2026-03-31'],
      );
    },
  );

  it('handles leap years without drifting the original day in following months', () => {
    const current = rule({
      startsOn: '2024-01-01',
      category: 'monthly',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
    });
    expect(dates(current, '2024-02-01', '2024-03-31')).toEqual([
      '2024-02-29',
      '2024-03-31',
    ]);
  });

  it('anchors quarterly recurrence to the start month across years', () => {
    const current = rule({
      startsOn: '2026-11-01',
      category: 'quarterly',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
    });
    expect(dates(current, '2026-11-01', '2027-06-01')).toEqual([
      '2026-11-30',
      '2027-02-28',
      '2027-05-31',
    ]);
  });

  it('uses six calendar months, not a fixed number of days', () => {
    const current = rule({
      startsOn: '2026-10-15',
      category: 'semiannual',
      pattern: { kind: 'months', dayOfMonth: 10, overflow: 'skip' },
    });
    expect(dates(current, '2026-10-01', '2027-10-01')).toEqual(['2027-04-10']);
  });

  it('clips inclusively to the requested range and the rule effective dates', () => {
    const current = rule({ startsOn: '2026-11-07', endsOn: '2026-11-21' });
    expect(dates(current, '2026-01-01', '2026-12-31')).toEqual([
      '2026-11-07',
      '2026-11-21',
    ]);
    expect(dates(current, '2026-11-21', '2026-11-21')).toEqual(['2026-11-21']);
  });

  it('does not depend on the configured time zone for civil-date arithmetic', () => {
    expect(
      dates(rule({ timeZone: 'Pacific/Auckland' }), '2026-11-01', '2026-11-30'),
    ).toEqual(
      dates(rule({ timeZone: 'America/New_York' }), '2026-11-01', '2026-11-30'),
    );
  });

  it('bounds generation and rejects reversed intervals', () => {
    expect(() =>
      assertRange({ from: '2026-01-01', to: '2027-01-02' }),
    ).toThrowError(new MaintenanceError('RANGE_TOO_LARGE'));
    expect(() =>
      assertRange({ from: '2026-11-02', to: '2026-11-01' }),
    ).toThrowError(new MaintenanceError('INVALID_RANGE'));
    expect(() =>
      assertRange({ from: '2024-01-01', to: '2024-12-31' }),
    ).not.toThrow();
  });

  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-2-01',
    '0000-01-01',
    'not-a-date',
  ])('rejects invalid civil dates %s', (date) => {
    expect(() => parseDate(date)).toThrowError(
      new MaintenanceError('INVALID_DATE'),
    );
  });
});

describe('recurrence approval and validation', () => {
  it.each<MaintenanceCategory>([
    'fortnightly',
    'monthly',
    'quarterly',
    'semiannual',
  ])('accepts supported category %s', (category) => {
    const pattern: RecurrencePattern =
      category === 'fortnightly'
        ? { kind: 'weekends', day: 'saturday' }
        : { kind: 'months', dayOfMonth: 15, overflow: 'skip' };
    expect(rule({ category, pattern }).toRecord()).toMatchObject({
      category,
      version: 1,
      approvedBy: 'admin',
    });
  });
  it('rejects unknown categories or incompatible recurrence kinds', () => {
    expect(() =>
      rule({ category: 'weekly' as MaintenanceCategory }),
    ).toThrowError(new MaintenanceError('INVALID_CATEGORY'));
    expect(() => rule({ category: 'monthly' })).toThrowError(
      new MaintenanceError('INVALID_RECURRENCE'),
    );
    expect(() =>
      rule({ pattern: { kind: 'months', dayOfMonth: 15, overflow: 'skip' } }),
    ).toThrowError(new MaintenanceError('INVALID_RECURRENCE'));
  });
  it.each([0, 32, 1.5, NaN])('rejects invalid monthly day %s', (dayOfMonth) => {
    expect(() =>
      rule({
        category: 'monthly',
        pattern: { kind: 'months', dayOfMonth, overflow: 'skip' },
      }),
    ).toThrowError(new MaintenanceError('INVALID_RECURRENCE'));
  });
  it('validates time, time zone and end dates', () => {
    expect(() => rule({ time: '24:00' })).toThrowError(
      new MaintenanceError('INVALID_TIME'),
    );
    expect(() => rule({ timeZone: 'invalid/zone' })).toThrowError(
      new MaintenanceError('INVALID_TIME_ZONE'),
    );
    expect(() => rule({ endsOn: '2025-12-31' })).toThrowError(
      new MaintenanceError('INVALID_RANGE'),
    );
  });
  it('keeps identity and old configuration immutable when revising approval', () => {
    const original = rule();
    const changes = {
      ...settings,
      id: 'injected',
      congregationId: 'other',
      time: '10:00',
    };
    const revised = original.revise(changes, 'other-admin', now);
    expect(revised.toRecord()).toMatchObject({
      id: original.id,
      congregationId: original.congregationId,
      version: 2,
      time: '10:00',
      approvedBy: 'other-admin',
    });
    expect(original.toRecord().time).toBe('09:00');
    expect(
      Object.isFrozen(revised.toRecord().defaults.responsibleMemberIds),
    ).toBe(true);
  });
});
