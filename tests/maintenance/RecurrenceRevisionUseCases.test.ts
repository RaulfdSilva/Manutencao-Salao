import { beforeEach, describe, expect, it } from 'vitest';
import { MaintenanceUseCases } from '../../src/application/maintenance/MaintenanceUseCases';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import { RecurrenceRule } from '../../src/domain/maintenance/RecurrenceRule';
import type {
  RecurrenceRevisionSettings,
  RecurrenceSettings,
} from '../../src/domain/maintenance/RecurrenceRule';
import {
  administrator as admin,
  configuration,
  MaintenanceTestEnvironment,
  now,
  schedule,
  settings,
} from './MaintenanceTestEnvironment';

let env: MaintenanceTestEnvironment;
let uc: MaintenanceUseCases;
let sequence: number;
const november = { from: '2026-11-01', to: '2026-11-30' };
const december = { from: '2026-12-01', to: '2026-12-31' };
const sunday: RecurrenceRevisionSettings = {
  ...settings,
  effectiveFrom: '2026-11-01',
  pattern: { kind: 'weekends', day: 'sunday' },
};

beforeEach(() => {
  env = new MaintenanceTestEnvironment();
  env.seedMember({ id: 'admin', role: 'administrator' });
  env.seedMember({ id: 'manager', role: 'maintenance_manager' });
  env.seedMember({ id: 'member' });
  sequence = 0;
  uc = new MaintenanceUseCases({
    transactions: env,
    ids: { next: () => `revision-${++sequence}` },
    clock: { now: () => now },
  });
});

describe('safe recurrence revision and cycle materialization', () => {
  it('does not recreate a cancelled Saturday cycle when revising to Sunday', async () => {
    const rule = await uc.approveRule(admin, settings);
    const generated = await uc.generate(admin, rule.id, november, 1);
    const first = generated[0];
    if (!first) throw new Error('Missing fixture');
    const cancelled = await uc.cancel(admin, first.id, 1);
    await uc.reviseRule(admin, rule.id, sunday, 1);
    const eventCount = env.events.length;
    const repeated = await uc.generate(admin, rule.id, november, 2);
    expect(repeated[0]).toEqual(cancelled);
    expect(repeated.map((o) => o.id)).toEqual(generated.map((o) => o.id));
    expect(env.occurrences.size).toBe(2);
    expect(env.events).toHaveLength(eventCount);
  });

  it('does not duplicate a Saturday rescheduled to Sunday when the rule changes to Sunday', async () => {
    const rule = await uc.approveRule(admin, settings);
    const [first] = await uc.generate(admin, rule.id, november, 1);
    if (!first) throw new Error('Missing fixture');
    const rescheduled = await uc.reschedule(
      admin,
      first.id,
      { ...schedule, date: '2026-11-08' },
      'reconfirm',
      1,
      { kind: 'keep', expectedVersion: null },
    );
    await uc.reviseRule(admin, rule.id, sunday, 1);
    const repeated = await uc.generate(admin, rule.id, november, 2);
    expect(repeated[0]).toEqual(rescheduled.occurrence);
    expect(
      [...env.occurrences.values()].filter(
        (o) => o.toRecord().schedule.date === '2026-11-08',
      ),
    ).toHaveLength(1);
    expect(
      env.events.find((e) => e.kind === 'occurrence_rescheduled')?.before,
    ).toEqual(first);
    expect(repeated[0]?.source).toEqual(first.source);
  });

  it('preserves future materialized occurrences and uses revised defaults only for unmaterialized cycles', async () => {
    const rule = await uc.approveRule(admin, settings);
    const first = (
      await uc.generate(
        admin,
        rule.id,
        { from: '2026-11-01', to: '2026-11-07' },
        1,
      )
    )[0];
    const future = (
      await uc.generate(
        admin,
        rule.id,
        { from: '2027-01-01', to: '2027-01-02' },
        1,
      )
    )[0];
    if (!first || !future) throw new Error('Missing fixtures');
    const assigned = await uc.assignTeam(admin, future.id, ['member'], 1);
    await uc.reviseRule(
      admin,
      rule.id,
      {
        ...sunday,
        time: '11:00',
        timeZone: 'UTC',
        defaults: { ...configuration, quantities: { minimum: 1, desired: 1 } },
      },
      1,
    );
    const generated = await uc.generate(
      admin,
      rule.id,
      { from: '2026-11-01', to: '2027-01-31' },
      2,
    );
    expect(generated.find((o) => o.id === first.id)).toEqual(first);
    expect(generated.find((o) => o.id === future.id)).toEqual(assigned);
    const newOnes = generated.filter(
      (o) => o.id !== first.id && o.id !== future.id,
    );
    expect(newOnes).toHaveLength(4);
    expect(
      newOnes.every(
        (o) =>
          o.source?.ruleVersion === 2 &&
          o.schedule.time === '11:00' &&
          o.schedule.timeZone === 'UTC' &&
          o.configuration.quantities.desired === 1,
      ),
    ).toBe(true);
    expect(newOnes[0]?.schedule.date).toBe('2026-11-22');
    expect(
      env.events.filter((e) => e.kind === 'occurrence_created'),
    ).toHaveLength(6);
  });

  it('uses earlier configuration before effectiveFrom even when no cycles have been materialized', async () => {
    const rule = await uc.approveRule(admin, settings);
    await uc.reviseRule(
      admin,
      rule.id,
      { ...sunday, effectiveFrom: '2026-12-01' },
      1,
    );
    const earlier = await uc.generate(admin, rule.id, november, 2);
    const later = await uc.generate(admin, rule.id, december, 2);
    expect(
      earlier.map((o) => [o.schedule.date, o.source?.ruleVersion]),
    ).toEqual([
      ['2026-11-07', 1],
      ['2026-11-21', 1],
    ]);
    expect(later.map((o) => [o.schedule.date, o.source?.ruleVersion])).toEqual([
      ['2026-12-06', 2],
      ['2026-12-20', 2],
    ]);
  });

  it.each(['monthly', 'quarterly', 'semiannual'] as const)(
    'prevents old %s cycles being recreated after day/overflow revision across a year',
    async (category) => {
      const original: RecurrenceSettings = {
        ...settings,
        category,
        startsOn: '2026-11-01',
        pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
      };
      const rule = await uc.approveRule(admin, original);
      const [first] = await uc.generate(admin, rule.id, november, 1);
      if (!first) throw new Error('Missing fixture');
      const moved = await uc.reschedule(
        admin,
        first.id,
        { ...schedule, date: '2027-01-15' },
        'preserve',
        1,
        { kind: 'keep', expectedVersion: null },
      );
      await uc.reviseRule(
        admin,
        rule.id,
        {
          ...original,
          effectiveFrom: '2026-11-01',
          pattern: { kind: 'months', dayOfMonth: 15, overflow: 'skip' },
        },
        1,
      );
      const repeated = await uc.generate(
        admin,
        rule.id,
        { from: '2026-11-01', to: '2027-06-30' },
        2,
      );
      expect(repeated[0]).toEqual(moved.occurrence);
      const next = repeated.slice(1);
      const expected =
        category === 'monthly'
          ? [
              '2026-12-15',
              '2027-01-15',
              '2027-02-15',
              '2027-03-15',
              '2027-04-15',
              '2027-05-15',
              '2027-06-15',
            ]
          : category === 'quarterly'
            ? ['2027-02-15', '2027-05-15']
            : ['2027-05-15'];
      expect(next.map((o) => o.schedule.date)).toEqual(expected);
      expect(next.every((o) => o.source?.ruleVersion === 2)).toBe(true);
      expect(new Set(repeated.map((o) => o.source?.cycleKey)).size).toBe(
        repeated.length,
      );
      expect(first.source?.cycleKey).toBe('month:2026-11');
    },
  );

  it.each(['monthly', 'quarterly', 'semiannual'] as const)(
    'keeps cancelled %s cycles cancelled after revision',
    async (category) => {
      const original: RecurrenceSettings = {
        ...settings,
        category,
        pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
      };
      const range = { from: '2026-01-01', to: '2026-01-31' };
      const rule = await uc.approveRule(admin, original);
      const [first] = await uc.generate(admin, rule.id, range, 1);
      if (!first) throw new Error('Missing fixture');
      const cancelled = await uc.cancel(admin, first.id, 1);
      await uc.reviseRule(
        admin,
        rule.id,
        {
          ...original,
          effectiveFrom: '2026-01-01',
          pattern: { kind: 'months', dayOfMonth: 1, overflow: 'skip' },
        },
        1,
      );
      expect(await uc.generate(admin, rule.id, range, 2)).toEqual([cancelled]);
      expect(env.occurrences.size).toBe(1);
    },
  );

  it('permits a newly applicable leap-month cycle previously skipped by the old rule', async () => {
    const original: RecurrenceSettings = {
      ...settings,
      category: 'monthly',
      startsOn: '2024-01-01',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'skip' },
    };
    const february = { from: '2024-02-01', to: '2024-02-29' };
    const rule = await uc.approveRule(admin, original);
    expect(await uc.generate(admin, rule.id, february, 1)).toEqual([]);
    await uc.reviseRule(
      admin,
      rule.id,
      {
        ...original,
        effectiveFrom: '2024-02-01',
        pattern: { kind: 'months', dayOfMonth: 29, overflow: 'last_day' },
      },
      1,
    );
    const [first] = await uc.generate(admin, rule.id, february, 2);
    expect(first).toMatchObject({
      schedule: { date: '2024-02-29' },
      source: { cycleKey: 'month:2024-02', ruleVersion: 2 },
    });
    expect(await uc.generate(admin, rule.id, february, 2)).toEqual([first]);
  });

  it('does not delete materialized cycles when revised end date or skip policy omits them', async () => {
    const original: RecurrenceSettings = {
      ...settings,
      category: 'monthly',
      pattern: { kind: 'months', dayOfMonth: 31, overflow: 'last_day' },
    };
    const february = { from: '2026-02-01', to: '2026-02-28' };
    const rule = await uc.approveRule(admin, original);
    const [first] = await uc.generate(admin, rule.id, february, 1);
    if (!first) throw new Error('Missing fixture');
    await uc.reviseRule(
      admin,
      rule.id,
      {
        ...original,
        effectiveFrom: '2026-02-01',
        endsOn: '2026-01-31',
        pattern: { kind: 'months', dayOfMonth: 31, overflow: 'skip' },
      },
      1,
    );
    expect(await uc.generate(admin, rule.id, february, 2)).toEqual([]);
    expect(await uc.get(admin, first.id)).toEqual(first);
    expect(await uc.list(admin, february)).toEqual([first]);
  });

  it('remains unique for repeated, overlapping and concurrent generation after revision', async () => {
    const rule = await uc.approveRule(admin, settings);
    await uc.generate(admin, rule.id, november, 1);
    await uc.reviseRule(admin, rule.id, sunday, 1);
    const results = await Promise.all([
      uc.generate(admin, rule.id, november, 2),
      uc.generate(admin, rule.id, { from: '2026-11-20', to: '2026-12-10' }, 2),
      uc.generate(admin, rule.id, { from: '2026-11-01', to: '2026-12-31' }, 2),
    ]);
    expect(results[0]?.map((o) => o.id)).toEqual(
      results[2]?.slice(0, 2).map((o) => o.id),
    );
    expect(env.occurrences.size).toBe(4);
    expect(
      env.events.filter((e) => e.kind === 'occurrence_created'),
    ).toHaveLength(4);
    expect(new Set(env.events.map((e) => e.id)).size).toBe(env.events.length);
  });

  it.each([true, false])(
    'serializes generation versus revision in either order: generationFirst=%s',
    async (generationFirst) => {
      const rule = await uc.approveRule(admin, settings);
      const generate = () => uc.generate(admin, rule.id, november, 1);
      const revise = () => uc.reviseRule(admin, rule.id, sunday, 1);
      const results = await Promise.allSettled(
        generationFirst ? [generate(), revise()] : [revise(), generate()],
      );
      expect(results[0]?.status).toBe('fulfilled');
      if (!generationFirst)
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { code: 'VERSION_CONFLICT' },
        });
      const final = await uc.generate(admin, rule.id, november, 2);
      expect(final.map((o) => o.schedule.date)).toEqual(
        generationFirst
          ? ['2026-11-07', '2026-11-21']
          : ['2026-11-08', '2026-11-22'],
      );
      expect(env.occurrences.size).toBe(2);
    },
  );

  it('allows only one competing revision of the same expected version and rejects stale generation', async () => {
    const rule = await uc.approveRule(admin, settings);
    const results = await Promise.allSettled([
      uc.reviseRule(admin, rule.id, sunday, 1),
      uc.reviseRule(admin, rule.id, { ...sunday, time: '10:00' }, 1),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' },
    });
    expect(env.rules.get(rule.id)?.toRecord().revisions).toHaveLength(2);
    await expect(
      uc.generate(admin, rule.id, november, 1),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(env.events.filter((e) => e.kind === 'rule_revised')).toHaveLength(1);
  });

  it('rolls back failed revision audit and CAS refusal without changing effective history', async () => {
    const rule = await uc.approveRule(admin, settings);
    env.failEvents = true;
    await expect(uc.reviseRule(admin, rule.id, sunday, 1)).rejects.toThrow(
      'Event storage unavailable',
    );
    expect(env.rules.get(rule.id)?.toRecord()).toEqual(rule);
    expect(env.events).toHaveLength(1);
    env.failEvents = false;
    env.rejectRuleSave = true;
    await expect(
      uc.reviseRule(admin, rule.id, sunday, 1),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(env.rules.get(rule.id)?.toRecord()).toEqual(rule);
    env.rejectRuleSave = false;
    expect(
      (await uc.generate(admin, rule.id, november, 1)).map(
        (o) => o.schedule.date,
      ),
    ).toEqual(['2026-11-07', '2026-11-21']);
  });

  it('rolls back a partially inserted batch after revision and permits a clean retry', async () => {
    const rule = await uc.approveRule(admin, settings);
    await uc.generate(
      admin,
      rule.id,
      { from: '2026-11-01', to: '2026-11-07' },
      1,
    );
    await uc.reviseRule(admin, rule.id, sunday, 1);
    const before = [...env.occurrences.values()].map((o) => o.toRecord());
    const events = [...env.events];
    let appended = 0;
    const failing = new MaintenanceUseCases({
      transactions: {
        run: (scope, work) =>
          env.run(scope, (tx) =>
            work({
              ...tx,
              events: {
                append: async (event) => {
                  await tx.events.append(event);
                  if (++appended === 2) throw new Error('Second append fails');
                },
              },
            }),
          ),
      },
      ids: { next: () => `failing-${++sequence}` },
      clock: { now: () => now },
    });
    await expect(
      failing.generate(
        admin,
        rule.id,
        { from: '2026-11-01', to: '2026-12-31' },
        2,
      ),
    ).rejects.toThrow('Second append fails');
    expect([...env.occurrences.values()].map((o) => o.toRecord())).toEqual(
      before,
    );
    expect(env.events).toEqual(events);
    const retry = await uc.generate(
      admin,
      rule.id,
      { from: '2026-11-01', to: '2026-12-31' },
      2,
    );
    expect(retry).toHaveLength(4);
    expect(retry[0]).toEqual(before[0]);
  });

  it('isolates uniqueness by rule and congregation while allowing legitimate date collisions', async () => {
    const firstRule = await uc.approveRule(admin, settings);
    const secondRule = await uc.approveRule(admin, settings);
    const foreignAdmin = { memberId: 'foreign-admin', congregationId: 'other' };
    env.seedMember({
      id: foreignAdmin.memberId,
      congregationId: 'other',
      role: 'administrator',
    });
    const foreignSettings = {
      ...settings,
      defaults: { ...configuration, responsibleMemberIds: [] },
    };
    const foreignRule = await uc.approveRule(foreignAdmin, foreignSettings);
    const range = { from: '2026-11-07', to: '2026-11-07' };
    const [first] = await uc.generate(admin, firstRule.id, range, 1);
    const [second] = await uc.generate(admin, secondRule.id, range, 1);
    const [foreign] = await uc.generate(foreignAdmin, foreignRule.id, range, 1);
    const manual = await uc.createOccurrence(admin, {
      category: 'fortnightly',
      schedule,
      configuration,
    });
    expect(new Set([first?.id, second?.id, foreign?.id, manual.id]).size).toBe(
      4,
    );
    expect(first?.source?.cycleKey).toBe(foreign?.source?.cycleKey);
    expect(await uc.list(admin, range)).toHaveLength(3);
    expect(await uc.list(foreignAdmin, range)).toEqual([foreign]);
    await expect(
      uc.reviseRule(foreignAdmin, firstRule.id, sunday, 1),
    ).rejects.toMatchObject({ code: 'RULE_NOT_FOUND' });
    await uc.reviseRule(admin, firstRule.id, sunday, 1);
    const [repeat] = await uc.generate(
      admin,
      firstRule.id,
      { from: '2026-11-08', to: '2026-11-08' },
      2,
    );
    expect(repeat).toEqual(first);
    expect(env.occurrences.size).toBe(4);
  });

  it('the scoped repository cycle constraint, not only the application, prevents duplicates', async () => {
    const rule = await uc.approveRule(admin, settings);
    const [first] = await uc.generate(admin, rule.id, november, 1);
    if (!first?.source) throw new Error('Missing fixture');
    const candidate = MaintenanceOccurrence.create({
      ...first,
      id: 'different-id',
      schedule: { ...first.schedule, date: '2026-11-08' },
      source: { ...first.source, slotDate: '2026-11-08', ruleVersion: 2 },
    });
    const stored = await env.run(admin.congregationId, (tx) =>
      tx.occurrences.insertGeneratedIfAbsent(candidate),
    );
    expect(stored.inserted).toBe(false);
    expect(stored.occurrence.toRecord()).toEqual(first);
    expect(env.occurrences.has('different-id')).toBe(false);
    await expect(
      env.run(admin.congregationId, (tx) => tx.occurrences.insert(candidate)),
    ).rejects.toThrowError(new MaintenanceError('INVALID_CONFIGURATION'));
  });

  it('rejects rewriting approval history or occurrence source through storage CAS', async () => {
    const rule = await uc.approveRule(admin, settings);
    const current = env.rules.get(rule.id);
    if (!current) throw new Error('Missing rule');
    const forged = RecurrenceRule.restore({
      ...rule,
      version: 2,
      revisions: [
        { ...current.latestRevision, time: '10:00' },
        { ...current.latestRevision, version: 2, effectiveFrom: '2026-11-01' },
      ],
    });
    await expect(
      env.run(admin.congregationId, (tx) => tx.rules.saveIfVersion(forged, 1)),
    ).rejects.toThrowError(new MaintenanceError('INVALID_RECURRENCE'));
    const [first] = await uc.generate(admin, rule.id, november, 1);
    if (!first?.source) throw new Error('Missing occurrence');
    const edited = MaintenanceOccurrence.restore({
      ...first,
      version: 2,
      source: { ...first.source, ruleVersion: 2 },
    });
    await expect(
      env.run(admin.congregationId, (tx) =>
        tx.occurrences.saveIfVersion(edited, 1),
      ),
    ).rejects.toThrowError(new MaintenanceError('INVALID_CYCLE'));
    expect(await uc.get(admin, first.id)).toEqual(first);
  });
});
