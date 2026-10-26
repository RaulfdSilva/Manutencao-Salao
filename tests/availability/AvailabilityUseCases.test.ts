import { beforeEach, describe, expect, it } from 'vitest';
import { AvailabilityUseCases } from '../../src/application/availability/AvailabilityUseCases';
import { AvailabilityPlan } from '../../src/domain/availability/AvailabilityPlan';
import {
  AvailabilityTestEnvironment,
  admin,
  manager,
  member,
  deadline,
  later,
} from './AvailabilityTestEnvironment';

let env: AvailabilityTestEnvironment, uc: AvailabilityUseCases;
function version() {
  return env.plan().toRecord().version;
}
async function configure() {
  return uc.configure(
    admin,
    'occurrence',
    deadline,
    env.occurrences.get('occurrence')?.version ?? 1,
  );
}
function current() {
  const occurrence = env.occurrences.get('occurrence');
  if (!occurrence) throw new Error('Missing occurrence');
  return occurrence;
}
function assigned(ids = ['member']) {
  const occurrence = current();
  env.replaceOccurrence(
    occurrence
      .configure({
        ...occurrence.toRecord().configuration,
        participationMode: 'assigned',
      })
      .assignTeam(ids),
  );
}
beforeEach(() => {
  env = new AvailabilityTestEnvironment();
  uc = new AvailabilityUseCases(env);
});

describe('availability application', () => {
  it('invites only active congregation members once and never assigns a yes respondent automatically', async () => {
    await configure();
    const invites = env.events.filter((e) => e.kind === 'invitation_needed');
    expect(invites.map((e) => e.memberId).sort()).toEqual([
      'admin',
      'manager',
      'member',
      'other',
    ]);
    const initialEvents = env.events.length;
    await configure();
    expect(env.events).toHaveLength(initialEvents);
    expect(env.jobs).toHaveLength(1);
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    expect(current().toRecord().assignedMemberIds).toEqual([]);
    expect(
      (await uc.mine({ ...admin, memberId: 'other' }, 'occurrence')).response,
    ).toBe('unanswered');
    expect(JSON.stringify(env.events)).not.toContain('phone');
  });
  it('invites and accepts answers only from designated members, including for administrator and manager roles', async () => {
    assigned();
    await configure();
    expect(
      env.events
        .filter((e) => e.kind === 'invitation_needed')
        .map((e) => e.memberId),
    ).toEqual(['member']);
    for (const actor of [admin, manager, { ...admin, memberId: 'other' }]) {
      await expect(
        uc.respond(actor, 'occurrence', 1, 'yes', version()),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    await uc.respond(member, 'occurrence', 1, 'maybe', version());
    expect((await uc.planning(manager, 'occurrence')).totals).toEqual({
      yes: 0,
      no: 0,
      maybe: 1,
      unanswered: 0,
    });
  });
  it('a designation is not required for open participation and silence is not a refusal', async () => {
    await configure();
    expect((await uc.planning(manager, 'occurrence')).totals).toEqual({
      yes: 0,
      no: 0,
      maybe: 0,
      unanswered: 4,
    });
    const active = env.members.get('member');
    if (!active) throw new Error('Missing member');
    expect(current().canParticipate(active)).toBe(true);
  });
  it('records modifications as last valid responses without an individual response history', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    await uc.respond(member, 'occurrence', 1, 'maybe', version());
    expect(env.plan().toRecord().answers).toEqual([
      { memberId: 'member', value: 'maybe' },
    ]);
    expect(
      env.events
        .filter((e) => e.kind.startsWith('response_'))
        .map((e) => e.kind),
    ).toEqual(['response_recorded', 'response_modified']);
    expect(env.events.every((e) => !('before' in e) && !('after' in e))).toBe(
      true,
    );
  });
  it('guards the exact deadline even if the server deadline job has not run', async () => {
    await configure();
    env.now = deadline;
    expect((await uc.mine(member, 'occurrence')).open).toBe(false);
    await expect(
      uc.respond(member, 'occurrence', 1, 'yes', version()),
    ).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
    expect(env.plan().toRecord().answers).toEqual([]);
  });
  it('closes without client interaction through a durable job, with idempotent retry', async () => {
    await configure();
    const job = env.jobs[0];
    if (!job) throw new Error('Missing job');
    env.now = deadline;
    await uc.closeDue(job);
    expect(env.plan().toRecord().closed).toBe(true);
    const events = env.events.length,
      closedVersion = version();
    await uc.closeDue(job);
    expect(version()).toBe(closedVersion);
    expect(env.events).toHaveLength(events);
    expect(env.events.filter((e) => e.kind === 'window_closed')).toHaveLength(
      1,
    );
  });
  it('does not close early for a job delivered before its due time', async () => {
    await configure();
    const job = env.jobs[0];
    if (!job) throw new Error('Missing job');
    await uc.closeDue(job);
    expect(version()).toBe(1);
    expect(env.plan().isOpen(env.now)).toBe(true);
  });
  it.each([true, false])(
    'allows yes to no after closure, manual=%s, producing an operational event without justification',
    async (manual) => {
      await configure();
      await uc.respond(member, 'occurrence', 1, 'yes', version());
      if (manual) await uc.close(admin, 'occurrence', 1, version());
      else env.now = deadline;
      const response = await uc.respond(
        member,
        'occurrence',
        1,
        'no',
        version(),
      );
      expect(response.open).toBe(false);
      expect(response.response).toBe('no');
      expect(
        env.events.filter((e) => e.kind === 'late_unavailability'),
      ).toHaveLength(1);
      const size = env.events.length;
      await uc.respond(member, 'occurrence', 1, 'no', version());
      expect(env.events).toHaveLength(size);
      await expect(
        uc.respond(member, 'occurrence', 1, 'yes', version()),
      ).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
    },
  );
  it('allows authorized reopening and makes previous jobs stale, retaining responses', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    const oldJob = env.jobs[0];
    if (!oldJob) throw new Error('Missing job');
    env.now = deadline;
    await uc.reopen(manager, 'occurrence', 1, later, version());
    expect((await uc.mine(member, 'occurrence')).response).toBe('yes');
    expect(env.jobs).toHaveLength(2);
    expect(
      env.events.filter((e) => e.kind === 'window_closed').at(-1)
        ?.windowGeneration,
    ).toBe(1);
    expect(
      env.events.filter((e) => e.kind === 'window_reopened').at(-1)
        ?.windowGeneration,
    ).toBe(2);
    const reopenedVersion = version();
    await uc.closeDue(oldJob);
    expect(version()).toBe(reopenedVersion);
    await uc.respond(
      { ...admin, memberId: 'other' },
      'occurrence',
      1,
      'yes',
      version(),
    );
    env.now = later;
    const newJob = env.jobs[1];
    if (!newJob) throw new Error('Missing new job');
    await uc.closeDue(newJob);
    expect(env.plan().toRecord().closed).toBe(true);
  });
  it.each(['member', 'other', 'inactive', 'foreign', 'missing'])(
    'denies window management and planning to unauthorized actor %s',
    async (memberId) => {
      await configure();
      const actor = { ...admin, memberId };
      await expect(uc.planning(actor, 'occurrence')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        uc.close(actor, 'occurrence', 1, version()),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        uc.reopen(actor, 'occurrence', 1, later, version()),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    },
  );
  it('requires an administrator to configure a window and does not trust declared role fields', async () => {
    await expect(
      uc.configure(
        { ...member, role: 'administrator' } as typeof member,
        'occurrence',
        deadline,
        1,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      uc.configure(manager, 'occurrence', deadline, 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({ id: 'manager', role: 'member' });
    await configure();
    await expect(uc.planning(manager, 'occurrence')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('removes stale invitations and responses from planning after designation removal', async () => {
    assigned();
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    env.replaceOccurrence(current().assignTeam([]));
    expect((await uc.planning(manager, 'occurrence')).totals).toEqual({
      yes: 0,
      no: 0,
      maybe: 0,
      unanswered: 0,
    });
    await expect(
      uc.respond(member, 'occurrence', 1, 'no', version()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect(env.plan().toRecord().audience).toEqual([]);
    expect(env.events.some((e) => e.kind === 'eligibility_changed')).toBe(true);
    env.replaceOccurrence(current().assignTeam(['member']));
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect((await uc.mine(member, 'occurrence')).response).toBe('unanswered');
  });
  it('revalidates inactive members and excludes their confirmations immediately', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    env.seedMember({ id: 'member', status: 'inactive', version: 2 });
    await expect(
      uc.respond(member, 'occurrence', 1, 'no', version()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await uc.planning(admin, 'occurrence')).totals.yes).toBe(0);
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect(env.plan().toRecord().answers).toEqual([]);
  });
  it('suppresses invitations and new responses for cancelled maintenance while retaining technical state', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    env.replaceOccurrence(current().cancel());
    await expect(
      uc.respond(member, 'occurrence', 1, 'no', version()),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_CANCELLED' });
    expect((await uc.planning(admin, 'occurrence')).open).toBe(false);
    const eventCount = env.events.filter(
      (e) => e.kind === 'invitation_needed',
    ).length;
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect(env.plans.size).toBe(0);
    expect(
      env.events.filter((e) => e.kind === 'invitation_needed'),
    ).toHaveLength(0);
    expect(env.jobs).toEqual([]);
    expect(eventCount).toBeGreaterThan(0);
    expect(env.disposals.size).toBe(1);
    expect(current().toRecord().status).toBe('cancelled');
  });
  it('preserves validity when rescheduling with preserve, without automatically reopening deadlines', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    env.now = deadline;
    env.replaceOccurrence(
      current().reschedule(
        { ...current().toRecord().schedule, date: '2027-01-01' },
        'preserve',
      ),
    );
    expect((await uc.mine(member, 'occurrence')).response).toBe('yes');
    expect((await uc.mine(member, 'occurrence')).open).toBe(false);
    expect(env.plan().toRecord().deadline).toBe(deadline);
  });
  it('requires a fresh explicitly configured window after reconfirmation and retains the old revision', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    const previous = env.plan().toRecord(),
      oldJob = env.jobs[0];
    env.replaceOccurrence(
      current().reschedule(
        { ...current().toRecord().schedule, date: '2027-01-01' },
        'reconfirm',
      ),
    );
    await expect(
      uc.respond(member, 'occurrence', 1, 'yes', previous.version),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(uc.mine(member, 'occurrence')).rejects.toMatchObject({
      code: 'WINDOW_NOT_CONFIGURED',
    });
    await configure();
    expect((await uc.mine(member, 'occurrence')).response).toBe('unanswered');
    expect(env.plan(1).toRecord()).toEqual(previous);
    expect(
      env.events.some(
        (e) => e.kind === 'reconfirmation_required' && e.revision === 2,
      ),
    ).toBe(true);
    if (!oldJob) throw new Error('Missing job');
    env.now = deadline;
    await uc.closeDue(oldJob);
    expect(env.plan(1).toRecord()).toEqual(previous);
  });
  it('provides all four totals and minimum warning without changing maintenance state or applying capacity', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    await uc.respond(manager, 'occurrence', 1, 'maybe', version());
    await uc.respond(
      { ...admin, memberId: 'other' },
      'occurrence',
      1,
      'no',
      version(),
    );
    const planning = await uc.planning(admin, 'occurrence');
    expect(planning.totals).toEqual({ yes: 1, no: 1, maybe: 1, unanswered: 1 });
    expect(planning.belowMinimum).toBe(true);
    await uc.respond(admin, 'occurrence', 1, 'yes', version());
    expect((await uc.planning(admin, 'occurrence')).belowMinimum).toBe(false);
    expect(current().toRecord().status).toBe('scheduled');
  });
  it('isolates data and allows separate congregations to use identical occurrence IDs in repository keys', async () => {
    await configure();
    env.seedMember({
      id: 'foreign-admin',
      role: 'administrator',
      congregationId: 'foreign',
    });
    const foreignAdmin = {
      congregationId: 'foreign',
      memberId: 'foreign-admin',
    };
    await expect(uc.planning(foreignAdmin, 'occurrence')).rejects.toMatchObject(
      { code: 'OCCURRENCE_NOT_FOUND' },
    );
    const otherPlan = AvailabilityPlan.create({
      congregationId: 'foreign',
      occurrenceId: 'occurrence',
      revision: 1,
      deadline,
      audience: ['foreign-admin'],
    });
    await env.run('foreign', (tx) => tx.availability.insertIfAbsent(otherPlan));
    expect(env.plan(1, 'foreign').toRecord().audience).toEqual([
      'foreign-admin',
    ]);
    expect(env.plan().toRecord().audience).not.toContain('foreign-admin');
  });
  it('rejects stale forms and prevents silent overwrite by concurrent responses', async () => {
    await configure();
    const results = await Promise.allSettled([
      uc.respond(member, 'occurrence', 1, 'yes', 1),
      uc.respond(member, 'occurrence', 1, 'no', 1),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' },
    });
    expect((await uc.mine(member, 'occurrence')).response).toBe('yes');
    await expect(uc.close(admin, 'occurrence', 1, 1)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
  });
  it('deduplicates concurrent configuration and rejects conflicting deadlines', async () => {
    await Promise.all([configure(), configure()]);
    expect(env.plans.size).toBe(1);
    expect(env.jobs).toHaveLength(1);
    await expect(
      uc.configure(admin, 'occurrence', later, 1),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
  it('handles storage CAS/unique refusal without writing events or answers', async () => {
    env.refuseInsert = true;
    await expect(configure()).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    expect(env.events).toEqual([]);
    env.refuseInsert = false;
    await configure();
    const count = env.events.length;
    env.refuseSave = true;
    await expect(
      uc.respond(member, 'occurrence', 1, 'yes', 1),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(env.plan().response('member')).toBe('unanswered');
    expect(env.events).toHaveLength(count);
  });
  it.each(['event', 'job'] as const)(
    'rolls back creation when %s persistence fails',
    async (failure) => {
      env.failEvents = failure === 'event';
      env.failJobs = failure === 'job';
      await expect(configure()).rejects.toThrow();
      expect(env.plans.size).toBe(0);
      expect(env.events).toEqual([]);
      expect(env.jobs).toEqual([]);
    },
  );
  it('rolls back answer and expired-window events together if a later event fails', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    const before = env.plan().toRecord(),
      events = [...env.events];
    env.now = deadline;
    env.failEvents = true;
    await expect(
      uc.respond(member, 'occurrence', 1, 'no', version()),
    ).rejects.toThrow('Event storage failed');
    expect(env.plan().toRecord()).toEqual(before);
    expect(env.events).toEqual(events);
  });
  it('rolls back reopening if durable deadline scheduling fails', async () => {
    await configure();
    env.now = deadline;
    const before = env.plan().toRecord(),
      events = [...env.events],
      jobs = [...env.jobs];
    env.failJobs = true;
    await expect(
      uc.reopen(manager, 'occurrence', 1, later, version()),
    ).rejects.toThrow('Job storage failed');
    expect(env.plan().toRecord()).toEqual(before);
    expect(env.events).toEqual(events);
    expect(env.jobs).toEqual(jobs);
  });
  it('rejects expired initial deadlines, invalid versions and stale occurrence configuration', async () => {
    env.now = deadline;
    await expect(configure()).rejects.toMatchObject({
      code: 'INVALID_DEADLINE',
    });
    await expect(
      uc.configure(admin, 'occurrence', later, 2),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    env.now = '2026-10-26T12:00:00.000Z';
    await configure();
    await expect(
      uc.respond(member, 'occurrence', 1, 'yes', 0),
    ).rejects.toMatchObject({ code: 'INVALID_VERSION' });
    expect(env.plans.size).toBe(1);
  });
  it('current-version no-ops do not duplicate response events and stale retries still conflict', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    const count = env.events.length,
      savedVersion = version();
    await uc.respond(member, 'occurrence', 1, 'yes', savedVersion);
    expect(env.events).toHaveLength(count);
    expect(version()).toBe(savedVersion);
    await expect(
      uc.respond(member, 'occurrence', 1, 'yes', 1),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
  it('rejects old invitation epochs after removal/reinclusion, while unrelated responses do not invalidate other invitations', async () => {
    assigned(['member', 'other']);
    await configure();
    const original = env.events.find(
      (e) => e.kind === 'invitation_needed' && e.memberId === 'member',
    );
    if (!original) throw new Error('Missing invitation');
    expect(await uc.invitationIsCurrent(original)).toBe(true);
    await uc.respond(
      { ...admin, memberId: 'other' },
      'occurrence',
      1,
      'yes',
      version(),
    );
    expect(await uc.invitationIsCurrent(original)).toBe(true);
    env.replaceOccurrence(current().assignTeam(['other']));
    expect(await uc.invitationIsCurrent(original)).toBe(false);
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    env.replaceOccurrence(current().assignTeam(['member', 'other']));
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect(await uc.invitationIsCurrent(original)).toBe(false);
    const replacement = env.events
      .filter((e) => e.kind === 'invitation_needed' && e.memberId === 'member')
      .at(-1);
    if (!replacement) throw new Error('Missing replacement');
    expect(await uc.invitationIsCurrent(replacement)).toBe(true);
    const count = env.events.length;
    await uc.refresh(admin.congregationId, 'occurrence', 1);
    expect(env.events).toHaveLength(count);
  });
  it('invalidates invitation delivery for answered, closed, inactive, cancelled and superseded-revision cases', async () => {
    await configure();
    const invite = env.events.find(
      (e) => e.kind === 'invitation_needed' && e.memberId === 'member',
    );
    if (!invite) throw new Error('Missing invitation');
    env.seedMember({ id: 'member', status: 'inactive' });
    expect(await uc.invitationIsCurrent(invite)).toBe(false);
    env.seedMember({ id: 'member' });
    env.now = deadline;
    expect(await uc.invitationIsCurrent(invite)).toBe(false);
    await uc.reopen(manager, 'occurrence', 1, later, version());
    expect(await uc.invitationIsCurrent(invite)).toBe(false);
    const reopened = env.events
      .filter((e) => e.kind === 'invitation_needed' && e.memberId === 'member')
      .at(-1);
    if (!reopened) throw new Error('Missing reopened invitation');
    expect(await uc.invitationIsCurrent(reopened)).toBe(true);
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    expect(await uc.invitationIsCurrent(reopened)).toBe(false);
    env.replaceOccurrence(
      current().reschedule(
        { ...current().toRecord().schedule, date: '2027-01-01' },
        'reconfirm',
      ),
    );
    expect(await uc.invitationIsCurrent(reopened)).toBe(false);
    env.replaceOccurrence(current().cancel());
    expect(await uc.invitationIsCurrent(reopened)).toBe(false);
  });
  it('rolls back designation changes and availability reconciliation together when using the shared transaction hook', async () => {
    assigned();
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    const originalOccurrence = current(),
      originalPlan = env.plan().toRecord();
    env.failEvents = true;
    await expect(
      env.run(admin.congregationId, async (tx) => {
        env.replaceOccurrence(current().assignTeam([]));
        await uc.refreshIn(tx, admin.congregationId, 'occurrence', 1);
      }),
    ).rejects.toThrow('Event storage failed');
    expect(current()).toBe(originalOccurrence);
    expect(env.plan().toRecord()).toEqual(originalPlan);
  });
  it('enforces repository CAS even when the application precheck is bypassed', async () => {
    await configure();
    const original = env.plan();
    const yes = original.respond('member', 'yes', env.now),
      no = original.respond('member', 'no', env.now);
    expect(
      await env.run(admin.congregationId, (tx) =>
        tx.availability.saveIfVersion(yes, 1),
      ),
    ).toBe(true);
    expect(
      await env.run(admin.congregationId, (tx) =>
        tx.availability.saveIfVersion(no, 1),
      ),
    ).toBe(false);
    expect(env.plan().response('member')).toBe('yes');
  });
  it('rejects an invalid trusted clock rather than persisting an invalid audit instant', async () => {
    await configure();
    await uc.respond(member, 'occurrence', 1, 'yes', version());
    await uc.close(admin, 'occurrence', 1, version());
    const before = env.plan().toRecord();
    env.now = 'invalid';
    await expect(
      uc.respond(member, 'occurrence', 1, 'no', version()),
    ).rejects.toMatchObject({ code: 'INVALID_INSTANT' });
    expect(env.plan().toRecord()).toEqual(before);
  });
  it('allows an authorized manager to close early and reopen', async () => {
    await configure();
    await uc.close(manager, 'occurrence', 1, version());
    expect((await uc.mine(member, 'occurrence')).open).toBe(false);
    await uc.reopen(manager, 'occurrence', 1, later, version());
    expect((await uc.mine(member, 'occurrence')).open).toBe(true);
  });
});
