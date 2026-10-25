import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberActor } from '../../src/application/members/MemberContracts';
import { MaintenanceUseCases } from '../../src/application/maintenance/MaintenanceUseCases';
import { MaintenanceOperationError } from '../../src/application/maintenance/MaintenanceOperationError';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import {
  administrator as admin,
  configuration,
  MaintenanceTestEnvironment,
  now,
  schedule,
  settings,
} from './MaintenanceTestEnvironment';

let environment: MaintenanceTestEnvironment;
let useCases: MaintenanceUseCases;
const manager: MemberActor = { ...admin, memberId: 'manager' };
const range = { from: '2026-11-01', to: '2026-11-30' };

beforeEach(() => {
  environment = new MaintenanceTestEnvironment();
  environment.seedMember({ id: 'admin', role: 'administrator' });
  environment.seedMember({ id: 'manager', role: 'maintenance_manager' });
  environment.seedMember({ id: 'other-manager', role: 'maintenance_manager' });
  environment.seedMember({ id: 'member' });
  environment.seedMember({ id: 'inactive', status: 'inactive' });
  environment.seedMember({ id: 'foreign', congregationId: 'other' });
  environment.seedOccurrence();
  let sequence = 0;
  useCases = new MaintenanceUseCases({
    transactions: environment,
    ids: { next: () => `generated-${++sequence}` },
    clock: { now: () => now },
  });
});

describe('approved planning and bounded generation', () => {
  it('approves configuration as an active administrator, ignoring injected identity or approval fields', async () => {
    const input = {
      ...settings,
      id: 'injected',
      approvedBy: 'member',
      congregationId: 'other',
    };
    const rule = await useCases.approveRule(admin, input);
    expect(rule).toMatchObject({
      id: 'generated-1',
      congregationId: admin.congregationId,
      approvedBy: 'admin',
      approvedAt: now,
      version: 1,
    });
    expect(environment.events[0]).toMatchObject({
      kind: 'rule_approved',
      actorId: 'admin',
      before: null,
      after: { id: rule.id },
    });
  });
  it('generates unique source slots, preserves defaults and audits only new records', async () => {
    const rule = await useCases.approveRule(admin, settings);
    const first = await useCases.generate(admin, rule.id, range, 1);
    const events = environment.events.length;
    const repeat = await useCases.generate(admin, rule.id, range, 1);
    const overlap = await useCases.generate(
      admin,
      rule.id,
      { from: '2026-11-20', to: '2026-12-10' },
      1,
    );
    expect(first.map((o) => o.schedule.date)).toEqual([
      '2026-11-07',
      '2026-11-21',
    ]);
    expect(repeat).toEqual(first);
    expect(overlap[0]?.id).toBe(first[1]?.id);
    expect(overlap[1]?.schedule.date).toBe('2026-12-05');
    expect(first[0]?.configuration).toEqual(configuration);
    expect(environment.events).toHaveLength(events + 1);
    expect(environment.occurrences.size).toBe(4); // One manual fixture and three generated slots.
    expect(new Set(environment.events.map((e) => e.id)).size).toBe(
      environment.events.length,
    );
  });
  it('does not recreate a cancelled slot or move a rescheduled one back to its original date', async () => {
    const rule = await useCases.approveRule(admin, settings);
    const generated = await useCases.generate(admin, rule.id, range, 1);
    const [first, second] = generated;
    if (!first || !second) throw new Error('Missing generated fixtures');
    await useCases.reschedule(
      admin,
      first.id,
      { ...schedule, date: '2026-12-01' },
      'preserve',
      1,
    );
    await useCases.cancel(admin, second.id, 1);
    const count = environment.events.length;
    const repeat = await useCases.generate(admin, rule.id, range, 1);
    expect(repeat.map((o) => [o.id, o.schedule.date, o.status])).toEqual([
      [first.id, '2026-12-01', 'scheduled'],
      [second.id, '2026-11-21', 'cancelled'],
    ]);
    expect(environment.events).toHaveLength(count);
    expect(environment.occurrences.size).toBe(3);
  });
  it('revises the approved rule without silently changing existing occurrences or their overrides', async () => {
    const rule = await useCases.approveRule(admin, settings);
    const generated = await useCases.generate(admin, rule.id, range, 1);
    const first = generated[0];
    if (!first) throw new Error('Missing fixture');
    const adjusted = await useCases.configure(
      admin,
      first.id,
      { ...configuration, quantities: { minimum: 1, desired: 2 } },
      1,
    );
    const revised = await useCases.reviseRule(
      admin,
      rule.id,
      {
        ...settings,
        time: '11:00',
        defaults: { ...configuration, quantities: { minimum: 4, desired: 5 } },
      },
      1,
    );
    expect(revised).toMatchObject({ version: 2, approvedBy: 'admin' });
    expect(await useCases.get(admin, first.id)).toEqual(adjusted);
    expect(generated[1]?.configuration.quantities).toEqual({
      minimum: 2,
      desired: 3,
    });
    const repeat = await useCases.generate(admin, rule.id, range, 2);
    expect(repeat[0]).toEqual(adjusted);
    expect(environment.events.at(-1)?.kind).toBe('rule_revised');
  });
  it('creates a specific date independent of a series and allows an active member to consult it', async () => {
    const occurrence = await useCases.createOccurrence(admin, {
      category: 'monthly',
      schedule,
      configuration,
    });
    expect(occurrence.source).toBeNull();
    expect(
      await useCases.get({ ...admin, memberId: 'member' }, occurrence.id),
    ).toEqual(occurrence);
    expect((await useCases.list(admin, range)).map((o) => o.id)).toContain(
      occurrence.id,
    );
  });
  it('requires active responsible members with the maintenance-manager role', async () => {
    for (const id of ['inactive', 'foreign', 'member', 'missing']) {
      await expect(
        useCases.approveRule(admin, {
          ...settings,
          defaults: { ...configuration, responsibleMemberIds: [id] },
        }),
      ).rejects.toThrowError(
        new MaintenanceOperationError('MEMBER_NOT_ELIGIBLE'),
      );
    }
    expect(environment.rules.size).toBe(0);
    expect(environment.events).toEqual([]);
  });
  it('bounds a generation request before writing any occurrences', async () => {
    const rule = await useCases.approveRule(admin, settings);
    await expect(
      useCases.generate(
        admin,
        rule.id,
        { from: '2026-01-01', to: '2027-12-31' },
        1,
      ),
    ).rejects.toThrowError(new MaintenanceError('RANGE_TOO_LARGE'));
    expect(environment.occurrences.size).toBe(1);
    expect(environment.events).toHaveLength(1);
  });
});

describe('participation and team authorization', () => {
  it('permits open participation without designations, but not team assignment', async () => {
    await useCases.configure(
      admin,
      'occurrence',
      { ...configuration, participationMode: 'open' },
      1,
    );
    expect(
      await useCases.participation(
        { ...admin, memberId: 'member' },
        'occurrence',
      ),
    ).toEqual({ allowed: true, planningWarning: null });
    await expect(
      useCases.assignTeam(manager, 'occurrence', ['member'], 2),
    ).rejects.toThrowError(new MaintenanceError('TEAM_NOT_ALLOWED'));
  });
  it('permits only an authorized manager or administrator to assign an active team', async () => {
    expect(
      (
        await useCases.participation(
          { ...admin, memberId: 'member' },
          'occurrence',
        )
      ).allowed,
    ).toBe(false);
    const assigned = await useCases.assignTeam(
      manager,
      'occurrence',
      ['member'],
      1,
    );
    expect(assigned.assignedMemberIds).toEqual(['member']);
    expect(
      await useCases.participation(
        { ...admin, memberId: 'member' },
        'occurrence',
      ),
    ).toEqual({ allowed: true, planningWarning: 'below_minimum' });
    expect((await useCases.participation(admin, 'occurrence')).allowed).toBe(
      true,
    );
    expect((await useCases.participation(manager, 'occurrence')).allowed).toBe(
      true,
    );
    await expect(
      useCases.assignTeam(
        { ...admin, memberId: 'other-manager' },
        'occurrence',
        [],
        2,
      ),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
    await expect(
      useCases.assignTeam(
        { ...admin, memberId: 'member' },
        'occurrence',
        [],
        2,
      ),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
  });
  it('does not require a minimum or enforce the desired quantity as a capacity limit', async () => {
    const assigned = await useCases.assignTeam(
      admin,
      'occurrence',
      ['admin', 'manager', 'other-manager', 'member'],
      1,
    );
    expect(assigned.assignedMemberIds).toHaveLength(4);
    expect(
      (await useCases.participation(admin, 'occurrence')).planningWarning,
    ).toBeNull();
    expect(assigned.status).toBe('scheduled');
  });
  it.each(['inactive', 'foreign', 'missing'])(
    'rejects an ineligible assignee %s with no partial update',
    async (id) => {
      await expect(
        useCases.assignTeam(manager, 'occurrence', ['member', id], 1),
      ).rejects.toThrowError(
        new MaintenanceOperationError('MEMBER_NOT_ELIGIBLE'),
      );
      expect(environment.occurrences.get('occurrence')?.version).toBe(1);
      expect(environment.events).toEqual([]);
    },
  );
  it('revalidates member activity instead of treating a designation as permanent access', async () => {
    await useCases.assignTeam(admin, 'occurrence', ['member'], 1);
    environment.seedMember({ id: 'member', status: 'inactive' });
    await expect(
      useCases.participation({ ...admin, memberId: 'member' }, 'occurrence'),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
  });
});

describe('administrative permissions and isolation', () => {
  const operations = [
    {
      name: 'approve',
      run: (actor: MemberActor) => useCases.approveRule(actor, settings),
    },
    {
      name: 'create',
      run: (actor: MemberActor) =>
        useCases.createOccurrence(actor, {
          category: 'fortnightly',
          configuration,
          schedule,
        }),
    },
    {
      name: 'reschedule',
      run: (actor: MemberActor) =>
        useCases.reschedule(actor, 'occurrence', schedule, 'preserve', 1),
    },
    {
      name: 'cancel',
      run: (actor: MemberActor) => useCases.cancel(actor, 'occurrence', 1),
    },
    {
      name: 'configure',
      run: (actor: MemberActor) =>
        useCases.configure(actor, 'occurrence', configuration, 1),
    },
  ];
  for (const operation of operations) {
    it.each(['member', 'manager', 'inactive'])(
      `denies ${operation.name} to %s`,
      async (memberId) => {
        await expect(
          operation.run({ ...admin, memberId }),
        ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
        expect(environment.events).toEqual([]);
        expect(environment.occurrences.get('occurrence')?.version).toBe(1);
        expect(environment.rules.size).toBe(0);
      },
    );
  }
  it('denies untrusted/missing or inactive actors and cross-congregation lookup', async () => {
    environment.seedOccurrence('foreign-occurrence', {
      congregationId: 'other',
    });
    await expect(
      useCases.get({ ...admin, memberId: 'inactive' }, 'occurrence'),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
    await expect(
      useCases.list({ ...admin, memberId: 'missing' }, range),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
    await expect(
      useCases.get({ ...admin, congregationId: 'other' }, 'foreign-occurrence'),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
    await expect(
      useCases.get(admin, 'foreign-occurrence'),
    ).rejects.toThrowError(
      new MaintenanceOperationError('OCCURRENCE_NOT_FOUND'),
    );
    await expect(
      useCases.cancel(admin, 'foreign-occurrence', 1),
    ).rejects.toThrowError(
      new MaintenanceOperationError('OCCURRENCE_NOT_FOUND'),
    );
    expect((await useCases.list(admin, range)).map((o) => o.id)).toEqual([
      'occurrence',
    ]);
  });
  it.each(['member', 'manager', 'inactive'])(
    'reserves generation and rule revision to administrators, denying %s',
    async (memberId) => {
      const rule = await useCases.approveRule(admin, settings);
      const actor = { ...admin, memberId };
      await expect(
        useCases.generate(actor, rule.id, range, 1),
      ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
      await expect(
        useCases.reviseRule(actor, rule.id, settings, 1),
      ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
      expect(environment.occurrences.size).toBe(1);
      expect(environment.events).toHaveLength(1);
    },
  );

  it('does not allow generating or revising a foreign recurrence rule', async () => {
    const otherRule = await useCases.approveRule(admin, settings);
    // Read using a real foreign actor, not a role supplied by the command.
    environment.seedMember({
      id: 'foreign-admin',
      congregationId: 'other',
      role: 'administrator',
    });
    const actor = { memberId: 'foreign-admin', congregationId: 'other' };
    await expect(
      useCases.generate(actor, otherRule.id, range, 1),
    ).rejects.toThrowError(new MaintenanceOperationError('RULE_NOT_FOUND'));
    await expect(
      useCases.reviseRule(actor, otherRule.id, settings, 1),
    ).rejects.toThrowError(new MaintenanceOperationError('RULE_NOT_FOUND'));
  });
});

describe('rescheduling, availability and definitive cancellation', () => {
  it.each(['preserve', 'reconfirm'] as const)(
    'reschedules only one occurrence with availability decision %s and invalidation intent',
    async (decision) => {
      environment.seedOccurrence('sibling');
      const result = await useCases.reschedule(
        admin,
        'occurrence',
        { ...schedule, date: '2026-11-14' },
        decision,
        1,
      );
      expect(result).toMatchObject({
        reconfirmationRecommended: true,
        occurrence: {
          id: 'occurrence',
          version: 2,
          availabilityRevision: decision === 'preserve' ? 1 : 2,
          schedule: { date: '2026-11-14' },
        },
      });
      expect(
        environment.occurrences.get('sibling')?.toRecord().schedule,
      ).toEqual(schedule);
      expect(environment.events[0]).toMatchObject({
        kind: 'occurrence_rescheduled',
        actorId: 'admin',
        occurredAt: now,
        before: { schedule, version: 1 },
        after: { version: 2 },
        invalidatesReminderVersionsThrough: 1,
        availabilityDecision: decision,
      });
    },
  );
  it('does not recommend reconfirmation solely because the hour changed, while honoring an explicit choice', async () => {
    const result = await useCases.reschedule(
      admin,
      'occurrence',
      { ...schedule, time: '10:00' },
      'reconfirm',
      1,
    );
    expect(result.reconfirmationRecommended).toBe(false);
    expect(result.occurrence.availabilityRevision).toBe(2);
  });
  it('allows an administrator to cancel even if a previously appointed manager became inactive', async () => {
    environment.seedMember({
      id: 'manager',
      role: 'maintenance_manager',
      status: 'inactive',
    });
    expect((await useCases.cancel(admin, 'occurrence', 1)).status).toBe(
      'cancelled',
    );
    expect(await useCases.participation(admin, 'occurrence')).toEqual({
      allowed: false,
      planningWarning: null,
    });
  });

  it('cancels only the selected occurrence, preserving data and producing later-notification information', async () => {
    environment.seedOccurrence('sibling');
    await useCases.assignTeam(admin, 'occurrence', ['member'], 1);
    const before = await useCases.get(admin, 'occurrence');
    const after = await useCases.cancel(admin, 'occurrence', 2);
    expect(after).toEqual({ ...before, status: 'cancelled', version: 3 });
    expect((await useCases.get(admin, 'sibling')).status).toBe('scheduled');
    expect(environment.events.at(-1)).toMatchObject({
      kind: 'occurrence_cancelled',
      before,
      after,
      invalidatesReminderVersionsThrough: 2,
    });
    expect(
      (
        await useCases.participation(
          { ...admin, memberId: 'member' },
          'occurrence',
        )
      ).allowed,
    ).toBe(false);
  });
  it('rejects every mutation of a cancelled occurrence without producing new events', async () => {
    await useCases.cancel(admin, 'occurrence', 1);
    const actions = [
      () => useCases.reschedule(admin, 'occurrence', schedule, 'preserve', 2),
      () => useCases.configure(admin, 'occurrence', configuration, 2),
      () => useCases.assignTeam(admin, 'occurrence', ['member'], 2),
      () => useCases.cancel(admin, 'occurrence', 2),
    ];
    for (const action of actions)
      await expect(action()).rejects.toThrowError(
        new MaintenanceError('OCCURRENCE_CANCELLED'),
      );
    expect(environment.events).toHaveLength(1);
  });
});

describe('versions, rollback and duplicate operations', () => {
  it('rejects stale occurrence edits and accepts exactly one simultaneous reschedule', async () => {
    const results = await Promise.allSettled([
      useCases.reschedule(
        admin,
        'occurrence',
        { ...schedule, date: '2026-11-14' },
        'preserve',
        1,
      ),
      useCases.reschedule(
        admin,
        'occurrence',
        { ...schedule, date: '2026-11-15' },
        'reconfirm',
        1,
      ),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' },
    });
    expect((await useCases.get(admin, 'occurrence')).schedule.date).toBe(
      '2026-11-14',
    );
    expect(environment.events).toHaveLength(1);
    await expect(useCases.cancel(admin, 'occurrence', 1)).rejects.toThrowError(
      new MaintenanceOperationError('VERSION_CONFLICT'),
    );
  });
  it('rejects invalid versions and checks authority before returning conflicts', async () => {
    await expect(useCases.cancel(admin, 'occurrence', 0)).rejects.toThrowError(
      new MaintenanceError('INVALID_VERSION'),
    );
    await expect(
      useCases.reschedule(manager, 'occurrence', schedule, 'preserve', 0),
    ).rejects.toThrowError(new MaintenanceOperationError('FORBIDDEN'));
    expect(environment.events).toEqual([]);
  });
  it('handles storage-level CAS refusal without audit or notification events', async () => {
    environment.rejectOccurrenceSave = true;
    await expect(useCases.cancel(admin, 'occurrence', 1)).rejects.toThrowError(
      new MaintenanceOperationError('VERSION_CONFLICT'),
    );
    expect((await useCases.get(admin, 'occurrence')).status).toBe('scheduled');
    expect(environment.events).toEqual([]);
  });
  it('rejects stale generation and rule revisions, including a storage-level refusal', async () => {
    const rule = await useCases.approveRule(admin, settings);
    await useCases.reviseRule(
      admin,
      rule.id,
      { ...settings, time: '10:00' },
      1,
    );
    await expect(
      useCases.generate(admin, rule.id, range, 1),
    ).rejects.toThrowError(new MaintenanceOperationError('VERSION_CONFLICT'));
    await expect(
      useCases.reviseRule(admin, rule.id, settings, 1),
    ).rejects.toThrowError(new MaintenanceOperationError('VERSION_CONFLICT'));
    environment.rejectRuleSave = true;
    await expect(
      useCases.reviseRule(admin, rule.id, settings, 2),
    ).rejects.toThrowError(new MaintenanceOperationError('VERSION_CONFLICT'));
    expect(environment.rules.get(rule.id)?.version).toBe(2);
    expect(environment.events).toHaveLength(2);
  });
  it('rolls back rule approval, generation and changes if durable event storage fails', async () => {
    environment.failEvents = true;
    await expect(useCases.approveRule(admin, settings)).rejects.toThrowError(
      'Event storage unavailable',
    );
    expect(environment.rules.size).toBe(0);
    environment.failEvents = false;
    const rule = await useCases.approveRule(admin, settings);
    environment.failEvents = true;
    await expect(
      useCases.generate(admin, rule.id, range, 1),
    ).rejects.toThrowError('Event storage unavailable');
    await expect(useCases.cancel(admin, 'occurrence', 1)).rejects.toThrowError(
      'Event storage unavailable',
    );
    expect(environment.occurrences.size).toBe(1);
    expect(environment.occurrences.get('occurrence')?.version).toBe(1);
    expect(environment.events).toHaveLength(1);
  });
  it('does not advance versions or create events for true no-ops', async () => {
    const original = await useCases.get(admin, 'occurrence');
    expect(
      (await useCases.reschedule(admin, 'occurrence', schedule, 'preserve', 1))
        .occurrence,
    ).toEqual(original);
    expect(
      await useCases.configure(admin, 'occurrence', configuration, 1),
    ).toEqual(original);
    expect(await useCases.assignTeam(manager, 'occurrence', [], 1)).toEqual(
      original,
    );
    expect(environment.events).toEqual([]);
  });
  it('serializes duplicate generation and does not publish duplicate creation events', async () => {
    const rule = await useCases.approveRule(admin, settings);
    const [first, second] = await Promise.all([
      useCases.generate(admin, rule.id, range, 1),
      useCases.generate(admin, rule.id, range, 1),
    ]);
    expect(first.map((o) => o.id)).toEqual(second.map((o) => o.id));
    expect(
      environment.events.filter((event) => event.kind === 'occurrence_created'),
    ).toHaveLength(2);
  });
});
