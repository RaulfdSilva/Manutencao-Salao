import { AvailabilityPlan } from '../../src/domain/availability/AvailabilityPlan';
import { beforeEach, describe, expect, it } from 'vitest';
import { AvailabilityUseCases } from '../../src/application/availability/AvailabilityUseCases';
import { completionDisposalRequest } from '../../src/application/availability/AvailabilityContracts';
import { MaintenanceUseCases } from '../../src/application/maintenance/MaintenanceUseCases';
import { technicalSnapshot } from '../../src/application/maintenance/MaintenanceLifecycleContracts';
import type { ResponseDeadlineDecision } from '../../src/application/maintenance/MaintenanceLifecycleContracts';
import {
  AvailabilityTestEnvironment,
  admin,
  manager,
  member,
  deadline,
  later,
} from './AvailabilityTestEnvironment';
let env: AvailabilityTestEnvironment,
  availability: AvailabilityUseCases,
  maintenance: MaintenanceUseCases;
const unsupported = async () => {
  throw new Error(
    'Unused rule/generation operation in this focused lifecycle adapter',
  );
};
function current() {
  const occurrence = env.occurrences.get('occurrence');
  if (!occurrence) throw new Error('Missing occurrence');
  return occurrence;
}
function version() {
  return env.plan().toRecord().version;
}
beforeEach(() => {
  env = new AvailabilityTestEnvironment();
  availability = new AvailabilityUseCases(env);
  let sequence = 0;
  maintenance = new MaintenanceUseCases({
    clock: env.clock,
    ids: { next: () => `created-${++sequence}` },
    transactions: {
      run: (scope, work) =>
        env.run(scope, (tx) =>
          work({
            members: tx.members,
            rules: {
              findById: unsupported,
              insert: unsupported,
              saveIfVersion: unsupported,
            },
            occurrences: {
              findById: tx.occurrences.findById,
              list: unsupported,
              insertGeneratedIfAbsent: unsupported,
              insert: async (occurrence) => {
                if (env.occurrences.has(occurrence.id))
                  throw new Error('Duplicate id');
                env.occurrences.set(occurrence.id, occurrence);
              },
              saveIfVersion: async (occurrence, expected) => {
                const old = env.occurrences.get(occurrence.id);
                if (
                  old?.congregationId !== scope ||
                  old.version !== expected ||
                  occurrence.version !== expected + 1
                )
                  return false;
                env.replaceOccurrence(occurrence);
                return true;
              },
            },
            events: {
              append: async (event) => {
                env.maintenanceEvents.push(event);
              },
            },
            technicalHistory: {
              record: async (snapshot) => {
                env.technical.push(snapshot);
              },
            },
            lifecycle: {
              availabilityAudienceChanged: (record) =>
                availability.refreshIn(
                  tx,
                  record.congregationId,
                  record.id,
                  record.availabilityRevision,
                ),
              availabilityRescheduled: (input) =>
                availability.rescheduleIn(tx, input),
              availabilityCancelled: (record, now) =>
                availability.discardCancelledIn(tx, record, now),
            },
          }),
        ),
    },
  });
});
async function configure() {
  await availability.configure(
    admin,
    'occurrence',
    deadline,
    current().version,
  );
}
function reschedule(
  responses: 'preserve' | 'reconfirm',
  choice: ResponseDeadlineDecision,
  date = '2026-12-05',
) {
  return maintenance.reschedule(
    admin,
    'occurrence',
    { ...current().toRecord().schedule, date },
    responses,
    current().version,
    choice,
  );
}

describe('approved availability product decisions', () => {
  it.each(['preserve', 'reconfirm'] as const)(
    'keeps the explicit deadline independently of response choice %s',
    async (responseChoice) => {
      await configure();
      await availability.respond(member, 'occurrence', 1, 'yes', version());
      const old = env.plan().toRecord();
      await reschedule(responseChoice, {
        kind: 'keep',
        expectedVersion: version(),
      });
      const revision = current().toRecord().availabilityRevision;
      expect(env.plan(revision).toRecord().deadline).toBe(deadline);
      expect(env.plan(revision).response('member')).toBe(
        responseChoice === 'preserve' ? 'yes' : 'unanswered',
      );
      if (responseChoice === 'reconfirm')
        expect(env.plan(1).toRecord()).toEqual(old);
      expect(env.maintenanceEvents.at(-1)).toMatchObject({
        kind: 'occurrence_rescheduled',
        availabilityDecision: responseChoice,
        deadlineDecision: { kind: 'keep' },
      });
    },
  );
  it.each(['preserve', 'reconfirm'] as const)(
    'replaces the explicit deadline independently of response choice %s',
    async (responseChoice) => {
      await configure();
      await availability.respond(member, 'occurrence', 1, 'yes', version());
      const invite = env.events.find(
        (e) => e.kind === 'invitation_needed' && e.memberId === 'other',
      );
      if (!invite) throw new Error('Missing invitation');
      const oldJob = env.jobs[0];
      if (!oldJob) throw new Error('Missing job');
      await reschedule(responseChoice, {
        kind: 'replace',
        deadline: later,
        expectedVersion: version(),
      });
      const revision = current().toRecord().availabilityRevision;
      expect(env.plan(revision).toRecord().deadline).toBe(later);
      expect(env.plan(revision).response('member')).toBe(
        responseChoice === 'preserve' ? 'yes' : 'unanswered',
      );
      expect(await availability.invitationIsCurrent(invite)).toBe(false);
      env.now = deadline;
      await availability.closeDue(oldJob);
      expect(env.plan(revision).isOpen(env.now)).toBe(true);
    },
  );
  it('requires an explicit valid decision and rejects missing choice without writes', async () => {
    await configure();
    const before = current();
    await expect(
      reschedule('preserve', undefined as unknown as ResponseDeadlineDecision),
    ).rejects.toMatchObject({ code: 'INVALID_DEADLINE_DECISION' });
    await expect(
      reschedule('preserve', {
        kind: 'replace',
        deadline: 'invalid',
        expectedVersion: version(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INSTANT' });
    expect(current()).toBe(before);
    expect(env.maintenanceEvents).toEqual([]);
  });
  it('checks administrator authority and rejects stale window versions without leaving the occurrence rescheduled', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const before = current();
    await expect(
      reschedule('preserve', { kind: 'keep', expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(current()).toBe(before);
    await expect(
      maintenance.reschedule(
        manager,
        'occurrence',
        current().toRecord().schedule,
        'preserve',
        current().version,
        { kind: 'keep', expectedVersion: version() },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('can configure an absent window with an explicit replacement but cannot keep a nonexistent deadline', async () => {
    const before = current();
    await expect(
      reschedule('preserve', { kind: 'keep', expectedVersion: null }),
    ).rejects.toMatchObject({ code: 'WINDOW_NOT_CONFIGURED' });
    expect(current()).toBe(before);
    await reschedule('preserve', {
      kind: 'replace',
      deadline: later,
      expectedVersion: null,
    });
    expect(env.plan().toRecord().deadline).toBe(later);
  });
  it('supports deadline-only edits with CAS without changing occurrence identity or response revision', async () => {
    await configure();
    const before = current();
    await reschedule(
      'preserve',
      { kind: 'replace', deadline: later, expectedVersion: version() },
      before.toRecord().schedule.date,
    );
    expect(current()).toBe(before);
    expect(env.plan().toRecord().revision).toBe(1);
    expect(env.events.some((e) => e.kind === 'deadline_changed')).toBe(true);
    expect(env.maintenanceEvents).toEqual([]);
  });
  it.each(['preserve', 'reconfirm'] as const)(
    'does not infer reopening from deadline replacement for %s',
    async (responseChoice) => {
      await configure();
      env.now = deadline;
      await reschedule(responseChoice, {
        kind: 'replace',
        deadline: later,
        expectedVersion: version(),
      });
      const revision = current().toRecord().availabilityRevision;
      expect(env.plan(revision).isOpen(env.now)).toBe(false);
      await availability.reopen(
        manager,
        'occurrence',
        revision,
        later,
        env.plan(revision).toRecord().version,
      );
      expect(env.plan(revision).isOpen(env.now)).toBe(true);
    },
  );
  it('rolls back maintenance, deadline, events and technical facts on job failure', async () => {
    await configure();
    const before = current(),
      plan = env.plan().toRecord(),
      events = [...env.events],
      jobs = [...env.jobs];
    env.failJobs = true;
    await expect(
      reschedule('reconfirm', {
        kind: 'replace',
        deadline: later,
        expectedVersion: version(),
      }),
    ).rejects.toThrow('Job storage failed');
    expect(current()).toBe(before);
    expect(env.plans.size).toBe(1);
    expect(env.plan().toRecord()).toEqual(plan);
    expect(env.events).toEqual(events);
    expect(env.jobs).toEqual(jobs);
    expect(env.technical).toEqual([]);
    expect(env.maintenanceEvents).toEqual([]);
  });
  it('removes responses on reinclusion and issues a fresh valid invitation only while the window is open', async () => {
    env.replaceOccurrence(
      current()
        .configure({
          ...current().toRecord().configuration,
          participationMode: 'assigned',
        })
        .assignTeam(['member']),
    );
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const old = env.events.find((e) => e.kind === 'invitation_needed');
    if (!old) throw new Error('Missing invitation');
    env.replaceOccurrence(current().assignTeam([]));
    await availability.refresh(admin.congregationId, 'occurrence', 1);
    env.replaceOccurrence(current().assignTeam(['member']));
    await availability.refresh(admin.congregationId, 'occurrence', 1);
    expect(env.plan().response('member')).toBe('unanswered');
    expect(await availability.invitationIsCurrent(old)).toBe(false);
    const fresh = env.events
      .filter((e) => e.kind === 'invitation_needed')
      .at(-1);
    if (!fresh) throw new Error('Missing new invitation');
    expect(await availability.invitationIsCurrent(fresh)).toBe(true);
    const active = env.members.get('member');
    if (!active) throw new Error('Missing member');
    expect(current().canParticipate(active)).toBe(true);
    env.now = deadline;
    env.replaceOccurrence(current().assignTeam([]));
    await availability.refresh(admin.congregationId, 'occurrence', 1);
    const count = env.events.filter(
      (e) => e.kind === 'invitation_needed',
    ).length;
    env.replaceOccurrence(current().assignTeam(['member']));
    await availability.refresh(admin.congregationId, 'occurrence', 1);
    expect(
      env.events.filter((e) => e.kind === 'invitation_needed'),
    ).toHaveLength(count);
  });
  it('discards every revision and individual event/job on real cancellation, preserving only nonpersonal technical history', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const stalePlan = env.plan();
    const invite = env.events.find((e) => e.kind === 'invitation_needed');
    if (!invite) throw new Error('Missing invitation');
    await reschedule('reconfirm', { kind: 'keep', expectedVersion: version() });
    expect(env.plans.size).toBe(2);
    await maintenance.cancel(admin, 'occurrence', current().version);
    expect(env.plans.size).toBe(0);
    expect(env.events).toEqual([]);
    expect(env.jobs).toEqual([]);
    expect(env.maintenanceEvents).toEqual([]);
    expect(env.disposals.size).toBe(1);
    expect(await availability.invitationIsCurrent(invite)).toBe(false);
    expect(env.technical.at(-1)).toMatchObject({
      status: 'cancelled',
      occurrenceId: 'occurrence',
    });
    const history = JSON.stringify(env.technical);
    for (const forbidden of [
      'memberId',
      'actorId',
      'assignedMemberIds',
      'responsibleMemberIds',
      'answers',
      'invitations',
      'phone',
    ])
      expect(history).not.toContain(forbidden);
    await expect(
      availability.planning(admin, 'occurrence'),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_DISPOSED' });
    expect(
      await env.run(admin.congregationId, (tx) =>
        tx.availability.insertIfAbsent(
          AvailabilityPlan.restore({ ...stalePlan.toRecord(), version: 1 }),
        ),
      ),
    ).toBe(false);
    await availability.refresh(
      admin.congregationId,
      'occurrence',
      current().toRecord().availabilityRevision,
    );
    expect(env.disposals.size).toBe(1);
  });
  it('discards historical revisions even when the current revision has no window', async () => {
    await configure();
    env.replaceOccurrence(
      current().reschedule(
        { ...current().toRecord().schedule, date: '2026-12-01' },
        'reconfirm',
      ),
    );
    await maintenance.cancel(admin, 'occurrence', current().version);
    expect(env.plans.size).toBe(0);
    expect(env.disposals.size).toBe(1);
  });
  it('rolls back cancellation and erasure together when a disposal adapter fails', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const occurrence = current(),
      plan = env.plan().toRecord(),
      events = [...env.events];
    env.failDisposal = true;
    await expect(
      maintenance.cancel(admin, 'occurrence', occurrence.version),
    ).rejects.toThrow('Disposal failed');
    expect(current()).toBe(occurrence);
    expect(env.plan().toRecord()).toEqual(plan);
    expect(env.events).toEqual(events);
    expect(env.disposals.size).toBe(0);
    expect(env.technical).toEqual([]);
  });
  it('keeps erasure scoped to the maintenance and congregation', async () => {
    await configure();
    env.seedOccurrence({ id: 'second' });
    await availability.configure(admin, 'second', deadline, 1);
    env.seedMember({
      id: 'foreign-admin',
      role: 'administrator',
      congregationId: 'foreign',
    });
    env.seedOccurrence({
      id: 'foreign-occurrence',
      congregationId: 'foreign',
      configuration: {
        participationMode: 'open',
        responsibleMemberIds: [],
        quantities: { minimum: null, desired: null },
      },
    });
    await availability.configure(
      { memberId: 'foreign-admin', congregationId: 'foreign' },
      'foreign-occurrence',
      deadline,
      1,
    );
    await maintenance.cancel(admin, 'occurrence', current().version);
    expect(env.plans.size).toBe(2);
    expect(
      env.plan(1, 'congregation', 'second').toRecord().audience.length,
    ).toBeGreaterThan(0);
    expect(
      env.plan(1, 'foreign', 'foreign-occurrence').toRecord().audience,
    ).toEqual(['foreign', 'foreign-admin']);
  });
  it('models future completion disposal as a whitelisted receipt conversion without creating a completed maintenance', () => {
    const occurrence = current();
    const request = completionDisposalRequest({
      congregationId: admin.congregationId,
      occurrenceId: 'occurrence',
      sourceVersion: 3,
      completedAt: env.now,
    });
    expect(request).toEqual({
      congregationId: admin.congregationId,
      occurrenceId: 'occurrence',
      sourceVersion: 3,
      terminal: 'completed',
      effectiveAt: env.now,
    });
    expect(current()).toBe(occurrence);
    expect(current().toRecord().status).toBe('scheduled');
    expect(env.disposals.size).toBe(0);
    expect(() =>
      completionDisposalRequest({
        congregationId: admin.congregationId,
        occurrenceId: 'occurrence',
        sourceVersion: 3,
        completedAt: 'invalid',
      }),
    ).toThrow('INVALID_INSTANT');
  });
  it('records technical scheduling facts at creation without individual counts or identities', async () => {
    const created = await maintenance.createOccurrence(admin, {
      category: 'monthly',
      schedule: current().toRecord().schedule,
      configuration: current().toRecord().configuration,
    });
    expect(env.technical).toHaveLength(1);
    expect(env.technical[0]).toEqual(technicalSnapshot(created, env.now));
    expect(Object.keys(env.technical[0] ?? {}).sort()).toEqual([
      'category',
      'congregationId',
      'observedAt',
      'occurrenceId',
      'schedule',
      'source',
      'status',
      'version',
    ]);
  });
  it('authorizes only active linked managers to close and keeps late yes-to-no available', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    env.seedMember({ id: 'other', role: 'maintenance_manager' });
    await expect(
      availability.close(
        { ...admin, memberId: 'other' },
        'occurrence',
        1,
        version(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({
      id: 'manager',
      role: 'maintenance_manager',
      status: 'inactive',
    });
    await expect(
      availability.close(manager, 'occurrence', 1, version()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({ id: 'manager', role: 'maintenance_manager' });
    await availability.close(manager, 'occurrence', 1, version());
    await availability.respond(member, 'occurrence', 1, 'no', version());
    expect(env.events.some((e) => e.kind === 'late_unavailability')).toBe(true);
    expect(env.plan().isOpen(env.now)).toBe(false);
  });
  it('preserves the terminal marker against a stale scheduled copy restored from a backup', async () => {
    await configure();
    const stale = current(),
      invite = env.events.find((e) => e.kind === 'invitation_needed');
    await maintenance.cancel(admin, 'occurrence', current().version);
    // Test a stale restored row, not a cancellation restoration use case.
    env.replaceOccurrence(stale);
    await expect(
      availability.configure(admin, 'occurrence', deadline, stale.version),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_DISPOSED' });
    await expect(
      availability.respond(member, 'occurrence', 1, 'yes', 1),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_DISPOSED' });
    if (!invite) throw new Error('Missing invitation');
    expect(await availability.invitationIsCurrent(invite)).toBe(false);
    expect(env.plans.size).toBe(0);
  });
  it('does not copy hidden nested personal fields into technical projections', () => {
    const record = current().toRecord();
    const input = {
      ...record,
      actorId: 'private',
      schedule: { ...record.schedule, memberId: 'private' },
    };
    const snapshot = technicalSnapshot(input, env.now);
    expect(JSON.stringify(snapshot)).not.toContain('private');
    expect(JSON.stringify(snapshot)).not.toContain('memberId');
  });
  it('regression: assignTeam removal and reinclusion must not recover an old yes', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    await maintenance.assignTeam(admin, 'occurrence', [], current().version);
    expect((await availability.planning(admin, 'occurrence')).totals.yes).toBe(
      0,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    expect((await availability.mine(member, 'occurrence')).response).toBe(
      'unanswered',
    );
  });
  it('regression: assignTeam reinclusion invalidates the old unanswered invitation', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    await configure();
    const old = env.events.find((e) => e.kind === 'invitation_needed');
    if (!old) throw new Error('Missing invitation');
    await maintenance.assignTeam(admin, 'occurrence', [], current().version);
    expect(await availability.invitationIsCurrent(old)).toBe(false);
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    expect(await availability.invitationIsCurrent(old)).toBe(false);
    const replacement = env.events
      .filter((e) => e.kind === 'invitation_needed')
      .at(-1);
    if (!replacement) throw new Error('Missing new invitation');
    expect(replacement.id).not.toBe(old.id);
    expect(await availability.invitationIsCurrent(replacement)).toBe(true);
  });
  it('regression: a new designation emits invitation-needed immediately without a response or refresh', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await configure();
    await maintenance.assignTeam(
      manager,
      'occurrence',
      ['member'],
      current().version,
    );
    expect(
      env.events.filter(
        (e) => e.kind === 'invitation_needed' && e.memberId === 'member',
      ),
    ).toHaveLength(1);
  });
  it('regression: open to assigned and back must not restore excluded responses', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    expect(env.plan().response('member')).toBe('unanswered');
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'open' },
      current().version,
    );
    expect((await availability.mine(member, 'occurrence')).response).toBe(
      'unanswered',
    );
    expect((await availability.planning(admin, 'occurrence')).totals.yes).toBe(
      0,
    );
  });
  it('preserves responses and invitation tokens of continuously eligible members and deduplicates no-ops', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member', 'other'],
      current().version,
    );
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const old = env.events.find(
      (e) => e.kind === 'invitation_needed' && e.memberId === 'other',
    );
    if (!old) throw new Error('Missing invitation');
    const originalToken = env
      .plan()
      .toRecord()
      .invitations.find((i) => i.memberId === 'other');
    await maintenance.assignTeam(
      manager,
      'occurrence',
      ['member', 'other', 'admin'],
      current().version,
    );
    expect(env.plan().response('member')).toBe('yes');
    expect(await availability.invitationIsCurrent(old)).toBe(true);
    expect(
      env
        .plan()
        .toRecord()
        .invitations.find((i) => i.memberId === 'other'),
    ).toEqual(originalToken);
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member', 'other'],
      current().version,
    );
    const saved = current(),
      plan = env.plan(),
      eventCount = env.events.length;
    await maintenance.assignTeam(
      manager,
      'occurrence',
      ['other', 'member'],
      current().version,
    );
    expect(current()).toBe(saved);
    expect(env.plan()).toBe(plan);
    expect(env.events).toHaveLength(eventCount);
    expect(
      env.events.filter(
        (e) => e.kind === 'invitation_needed' && e.memberId === 'other',
      ),
    ).toHaveLength(1);
    expect(new Set(env.events.map((e) => e.id)).size).toBe(env.events.length);
  });
  it('does not reconcile or invalidate availability for quantities/responsibility-only configuration changes', async () => {
    await configure();
    await availability.respond(member, 'occurrence', 1, 'yes', version());
    const plan = env.plan(),
      events = [...env.events];
    await maintenance.configure(
      admin,
      'occurrence',
      {
        ...current().toRecord().configuration,
        quantities: { minimum: 1, desired: 3 },
        responsibleMemberIds: [],
      },
      current().version,
    );
    expect(env.plan()).toBe(plan);
    expect(env.events).toEqual(events);
    expect(env.plan().response('member')).toBe('yes');
  });
  it.each(['assign', 'configure'] as const)(
    'rolls back occurrence, availability and both event streams after reconciliation failure in %s',
    async (operation) => {
      if (operation === 'assign') {
        await maintenance.configure(
          admin,
          'occurrence',
          {
            ...current().toRecord().configuration,
            participationMode: 'assigned',
          },
          current().version,
        );
        await maintenance.assignTeam(
          admin,
          'occurrence',
          ['member'],
          current().version,
        );
      }
      await configure();
      await availability.respond(member, 'occurrence', 1, 'yes', version());
      const before = current(),
        plan = env.plan(),
        events = [...env.events],
        maintenanceEvents = [...env.maintenanceEvents],
        technical = [...env.technical],
        jobs = [...env.jobs];
      env.failEvents = true;
      const action =
        operation === 'assign'
          ? maintenance.assignTeam(admin, 'occurrence', [], current().version)
          : maintenance.configure(
              admin,
              'occurrence',
              {
                ...current().toRecord().configuration,
                participationMode: 'assigned',
              },
              current().version,
            );
      await expect(action).rejects.toThrow('Event storage failed');
      expect(current()).toBe(before);
      expect(env.plan()).toBe(plan);
      expect(env.events).toEqual(events);
      expect(env.maintenanceEvents).toEqual(maintenanceEvents);
      expect(env.technical).toEqual(technical);
      expect(env.jobs).toEqual(jobs);
    },
  );
  it('rolls back the team when availability storage rejects its conditional save', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    await configure();
    const before = current(),
      plan = env.plan(),
      events = [...env.events],
      history = [...env.technical];
    env.refuseSave = true;
    await expect(
      maintenance.assignTeam(manager, 'occurrence', [], current().version),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(current()).toBe(before);
    expect(env.plan()).toBe(plan);
    expect(env.events).toEqual(events);
    expect(env.technical).toEqual(history);
  });
  it('rejects stale team versions and accepts only one concurrent team change', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await configure();
    const expected = current().version;
    const results = await Promise.allSettled([
      maintenance.assignTeam(manager, 'occurrence', ['member'], expected),
      maintenance.assignTeam(admin, 'occurrence', ['other'], expected),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' },
    });
    expect(env.plan().toRecord().audience).toEqual(['member']);
    expect(
      env.events.filter((e) => e.kind === 'invitation_needed'),
    ).toHaveLength(1);
    await expect(
      maintenance.assignTeam(admin, 'occurrence', [], expected),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
  it('enforces administrator configuration and authorized active manager team permissions', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await configure();
    env.seedMember({ id: 'other', role: 'maintenance_manager' });
    await expect(
      maintenance.assignTeam(
        { ...admin, memberId: 'other' },
        'occurrence',
        ['member'],
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      maintenance.assignTeam(
        member,
        'occurrence',
        ['member'],
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      maintenance.configure(
        manager,
        'occurrence',
        { ...current().toRecord().configuration, participationMode: 'open' },
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({
      id: 'manager',
      role: 'maintenance_manager',
      status: 'inactive',
    });
    await expect(
      maintenance.assignTeam(
        manager,
        'occurrence',
        ['member'],
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(env.plan().toRecord().audience).toEqual([]);
    env.seedMember({ id: 'manager', role: 'maintenance_manager' });
    await maintenance.assignTeam(
      manager,
      'occurrence',
      ['member'],
      current().version,
    );
    expect(env.plan().toRecord().audience).toEqual(['member']);
  });
  it.each(['manual', 'deadline'] as const)(
    'updates eligibility in a %s-closed window without invitations or reopening, then invites after explicit reopen',
    async (closure) => {
      await maintenance.configure(
        admin,
        'occurrence',
        {
          ...current().toRecord().configuration,
          participationMode: 'assigned',
        },
        current().version,
      );
      await configure();
      if (closure === 'manual')
        await availability.close(manager, 'occurrence', 1, version());
      else env.now = deadline;
      await maintenance.assignTeam(
        manager,
        'occurrence',
        ['member'],
        current().version,
      );
      expect(env.plan().toRecord().audience).toEqual(['member']);
      expect(env.plan().isOpen(env.now)).toBe(false);
      expect(
        env.events.filter((e) => e.kind === 'invitation_needed'),
      ).toHaveLength(0);
      await maintenance.assignTeam(admin, 'occurrence', [], current().version);
      await maintenance.assignTeam(
        admin,
        'occurrence',
        ['member'],
        current().version,
      );
      expect(env.plan().response('member')).toBe('unanswered');
      await availability.reopen(manager, 'occurrence', 1, later, version());
      const invitations = env.events.filter(
        (e) => e.kind === 'invitation_needed',
      );
      expect(invitations).toHaveLength(1);
      const invitation = invitations[0];
      if (!invitation) throw new Error('Missing invitation');
      expect(await availability.invitationIsCurrent(invitation)).toBe(true);
    },
  );
  it('does not create a window merely because a team or mode changes', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      manager,
      'occurrence',
      ['member'],
      current().version,
    );
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'open' },
      current().version,
    );
    expect(env.plans.size).toBe(0);
    expect(env.events).toEqual([]);
    expect(env.jobs).toEqual([]);
  });
  it('reconciles only the current response revision and leaves obsolete revisions untouched until terminal disposal', async () => {
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await configure();
    await reschedule('reconfirm', { kind: 'keep', expectedVersion: version() });
    const previous = env.plan(1);
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    expect(env.plan(1)).toBe(previous);
    expect(env.plan(2).toRecord().audience).toEqual(['member']);
    expect(
      env.events
        .filter(
          (e) => e.kind === 'invitation_needed' && e.memberId === 'member',
        )
        .map((e) => e.revision),
    ).toEqual([2]);
  });
  it('keeps reconciliation isolated by congregation and rejects cross-congregation assignments', async () => {
    await configure();
    const original = env.plan();
    env.seedMember({
      id: 'foreign-admin',
      role: 'administrator',
      congregationId: 'foreign',
    });
    env.seedMember({ id: 'foreign-member', congregationId: 'foreign' });
    const foreignAdmin = {
      memberId: 'foreign-admin',
      congregationId: 'foreign',
    };
    env.seedOccurrence({
      id: 'foreign-occurrence',
      congregationId: 'foreign',
      configuration: {
        participationMode: 'assigned',
        responsibleMemberIds: [],
        quantities: { minimum: null, desired: null },
      },
    });
    await availability.configure(
      foreignAdmin,
      'foreign-occurrence',
      deadline,
      1,
    );
    await expect(
      maintenance.assignTeam(
        foreignAdmin,
        'occurrence',
        ['foreign-member'],
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_NOT_FOUND' });
    await expect(
      maintenance.assignTeam(foreignAdmin, 'foreign-occurrence', ['member'], 1),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_ELIGIBLE' });
    await maintenance.assignTeam(
      foreignAdmin,
      'foreign-occurrence',
      ['foreign-member'],
      1,
    );
    expect(env.plan()).toBe(original);
    expect(
      env.plan(1, 'foreign', 'foreign-occurrence').toRecord().audience,
    ).toEqual(['foreign-member']);
    expect(
      env.events
        .filter(
          (e) =>
            e.kind === 'invitation_needed' && e.memberId === 'foreign-member',
        )
        .every((e) => e.congregationId === 'foreign'),
    ).toBe(true);
  });
  it('does not recreate availability for cancelled maintenance or a retained terminal marker', async () => {
    await configure();
    const stale = current();
    await maintenance.cancel(admin, 'occurrence', current().version);
    await expect(
      maintenance.assignTeam(admin, 'occurrence', [], current().version),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_CANCELLED' });
    await expect(
      maintenance.configure(
        admin,
        'occurrence',
        {
          ...current().toRecord().configuration,
          participationMode: 'assigned',
        },
        current().version,
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_CANCELLED' });
    expect(env.plans.size).toBe(0);
    expect(env.events).toEqual([]);
    // Simulate a stale operational row restored without removing the terminal marker.
    env.replaceOccurrence(stale);
    await maintenance.configure(
      admin,
      'occurrence',
      { ...current().toRecord().configuration, participationMode: 'assigned' },
      current().version,
    );
    await maintenance.assignTeam(
      admin,
      'occurrence',
      ['member'],
      current().version,
    );
    expect(env.plans.size).toBe(0);
    expect(env.events).toEqual([]);
    expect(env.jobs).toEqual([]);
    expect(env.disposals.size).toBe(1);
  });
  it.each(['manual', 'deadline'] as const)(
    'does not restore an old yes after removal/reinclusion in a %s-closed window',
    async (closure) => {
      await maintenance.configure(
        admin,
        'occurrence',
        {
          ...current().toRecord().configuration,
          participationMode: 'assigned',
        },
        current().version,
      );
      await maintenance.assignTeam(
        admin,
        'occurrence',
        ['member'],
        current().version,
      );
      await configure();
      await availability.respond(member, 'occurrence', 1, 'yes', version());
      if (closure === 'manual')
        await availability.close(manager, 'occurrence', 1, version());
      else env.now = deadline;
      const invitations = env.events.filter(
        (e) => e.kind === 'invitation_needed',
      ).length;
      await maintenance.assignTeam(
        manager,
        'occurrence',
        [],
        current().version,
      );
      await maintenance.assignTeam(
        manager,
        'occurrence',
        ['member'],
        current().version,
      );
      expect(env.plan().response('member')).toBe('unanswered');
      expect(env.plan().isOpen(env.now)).toBe(false);
      expect(
        env.events.filter((e) => e.kind === 'invitation_needed'),
      ).toHaveLength(invitations);
      await expect(
        availability.respond(member, 'occurrence', 1, 'no', version()),
      ).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
    },
  );
  it.each([true, false])(
    'serializes response versus removal without restoring a response: responseFirst=%s',
    async (responseFirst) => {
      await maintenance.configure(
        admin,
        'occurrence',
        {
          ...current().toRecord().configuration,
          participationMode: 'assigned',
        },
        current().version,
      );
      await maintenance.assignTeam(
        admin,
        'occurrence',
        ['member'],
        current().version,
      );
      await configure();
      const occurrenceVersion = current().version,
        planVersion = version();
      const respond = () =>
        availability.respond(member, 'occurrence', 1, 'yes', planVersion);
      const remove = () =>
        maintenance.assignTeam(manager, 'occurrence', [], occurrenceVersion);
      const results = await Promise.allSettled(
        responseFirst ? [respond(), remove()] : [remove(), respond()],
      );
      expect(results[0].status).toBe('fulfilled');
      if (responseFirst) expect(results[1].status).toBe('fulfilled');
      else
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { code: 'FORBIDDEN' },
        });
      expect(env.plan().response('member')).toBe('unanswered');
      expect(current().toRecord().assignedMemberIds).toEqual([]);
    },
  );
});
