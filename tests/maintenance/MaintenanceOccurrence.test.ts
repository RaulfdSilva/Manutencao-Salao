import { describe, expect, it } from 'vitest';
import { Member } from '../../src/domain/members/Member';
import type { MemberRole } from '../../src/domain/members/Member';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import type {
  AvailabilityDecision,
  MaintenanceConfiguration,
} from '../../src/domain/maintenance/MaintenanceTypes';
import { assessPlannedParticipation } from '../../src/domain/maintenance/MaintenanceTypes';
import { configuration, schedule } from './MaintenanceTestEnvironment';

function occurrence(config = configuration): MaintenanceOccurrence {
  return MaintenanceOccurrence.create({
    id: 'occurrence',
    congregationId: 'congregation',
    category: 'fortnightly',
    schedule,
    configuration: config,
    assignedMemberIds: [],
    source: {
      ruleId: 'rule',
      slotDate: schedule.date,
      weekendStart: schedule.date,
    },
  });
}
function member(
  id: string,
  role: MemberRole = 'member',
  status: 'active' | 'inactive' = 'active',
  congregationId = 'congregation',
): Member {
  const active = Member.create({ id, name: 'Pessoa', role, congregationId });
  return status === 'active' ? active : active.deactivate();
}

describe('maintenance occurrence', () => {
  it('preserves identity, source slot and previous snapshots after rescheduling', () => {
    const original = occurrence();
    const after = original.reschedule(
      { ...schedule, date: '2026-11-14' },
      'preserve',
    );
    expect(after.toRecord()).toMatchObject({
      id: 'occurrence',
      version: 2,
      source: { slotDate: '2026-11-07' },
      schedule: { date: '2026-11-14' },
      availabilityRevision: 1,
    });
    expect(original.toRecord().schedule.date).toBe('2026-11-07');
    expect(Object.isFrozen(after.toRecord().schedule)).toBe(true);
    expect(Object.isFrozen(after.toRecord().configuration.quantities)).toBe(
      true,
    );
  });
  it('advances only the availability generation when reconfirmation is requested', () => {
    const original = occurrence();
    const after = original.reschedule(
      { ...schedule, time: '10:00' },
      'reconfirm',
    );
    expect(after.toRecord()).toMatchObject({
      version: 2,
      availabilityRevision: 2,
    });
    expect(original.reschedule(schedule, 'preserve')).toBe(original);
    expect(() =>
      original.reschedule(schedule, 'delete' as AvailabilityDecision),
    ).toThrowError(new MaintenanceError('INVALID_AVAILABILITY_DECISION'));
  });
  it('cancels definitively without erasing technical data or team configuration', () => {
    const original = occurrence().assignTeam(['member']);
    const cancelled = original.cancel();
    expect(cancelled.toRecord()).toEqual({
      ...original.toRecord(),
      version: 3,
      status: 'cancelled',
    });
    expect(cancelled.canParticipate(member('member'))).toBe(false);
    for (const mutate of [
      () => cancelled.cancel(),
      () => cancelled.reschedule(schedule, 'preserve'),
      () => cancelled.configure(configuration),
      () => cancelled.assignTeam([]),
    ])
      expect(mutate).toThrowError(new MaintenanceError('OCCURRENCE_CANCELLED'));
  });

  it('allows any active member of the congregation in open participation without assigning a team', () => {
    const open = occurrence({ ...configuration, participationMode: 'open' });
    expect(open.canParticipate(member('ordinary'))).toBe(true);
    expect(open.canParticipate(member('inactive', 'member', 'inactive'))).toBe(
      false,
    );
    expect(
      open.canParticipate(member('foreign', 'member', 'active', 'other')),
    ).toBe(false);
    expect(() => open.assignTeam(['ordinary'])).toThrowError(
      new MaintenanceError('TEAM_NOT_ALLOWED'),
    );
    expect(open.planningWarning()).toBeNull();
  });
  it('restricts assigned teams to assignees, administrators and explicitly authorized managers', () => {
    const assigned = occurrence().assignTeam(['ordinary']);
    expect(assigned.canParticipate(member('ordinary'))).toBe(true);
    expect(assigned.canParticipate(member('unassigned'))).toBe(false);
    expect(assigned.canParticipate(member('admin', 'administrator'))).toBe(
      true,
    );
    expect(
      assigned.canParticipate(member('manager', 'maintenance_manager')),
    ).toBe(true);
    expect(
      assigned.canParticipate(member('another-manager', 'maintenance_manager')),
    ).toBe(false);
    expect(assigned.canManageTeam(member('ordinary'))).toBe(false);
    expect(
      assigned.canManageTeam(member('manager', 'maintenance_manager')),
    ).toBe(true);
    expect(
      assigned.canParticipate(member('ordinary', 'member', 'inactive')),
    ).toBe(false);
  });
  it('does not cap the team or cancel the occurrence based on planning quantities', () => {
    const original = occurrence();
    expect(original.planningWarning()).toBe('below_minimum');
    const large = original.assignTeam(['a', 'b', 'c', 'd']);
    expect(large.toRecord().assignedMemberIds).toHaveLength(4);
    expect(large.planningWarning()).toBeNull();
    expect(original.toRecord().status).toBe('scheduled');
  });
  it('clears designations only when explicitly changing to open mode, retaining previous snapshots', () => {
    const assigned = occurrence().assignTeam(['ordinary']);
    const open = assigned.configure({
      ...configuration,
      participationMode: 'open',
    });
    expect(open.toRecord().assignedMemberIds).toEqual([]);
    expect(assigned.toRecord().assignedMemberIds).toEqual(['ordinary']);
    expect(
      open.configure({ ...configuration, participationMode: 'open' }),
    ).toBe(open);
  });
  it('normalizes ordering without duplicate assignments and does not increment no-ops', () => {
    const assigned = occurrence().assignTeam(['b', 'a']);
    expect(assigned.toRecord().assignedMemberIds).toEqual(['a', 'b']);
    expect(assigned.assignTeam(['a', 'b'])).toBe(assigned);
    expect(() => assigned.assignTeam(['a', 'a'])).toThrowError(
      new MaintenanceError('INVALID_CONFIGURATION'),
    );
    expect(occurrence().configure(configuration).version).toBe(1);
  });
  it.each([
    { minimum: -1, desired: 2 },
    { minimum: 3, desired: 2 },
    { minimum: 1.5, desired: null },
    { minimum: null, desired: Infinity },
  ])('rejects inconsistent quantities %j', (quantities) => {
    expect(() => occurrence({ ...configuration, quantities })).toThrowError(
      new MaintenanceError('INVALID_QUANTITIES'),
    );
  });
  it.each([
    { minimum: null, desired: null },
    { minimum: 0, desired: 0 },
    { minimum: 2, desired: null },
  ])('allows optional or zero planning quantities %j', (quantities) => {
    expect(() => occurrence({ ...configuration, quantities })).not.toThrow();
  });
  it('rejects invalid modes and estimates without confusing estimates with presence', () => {
    expect(() =>
      occurrence({
        ...configuration,
        participationMode: 'attendance',
      } as unknown as MaintenanceConfiguration),
    ).toThrowError(new MaintenanceError('INVALID_CONFIGURATION'));
    expect(() =>
      assessPlannedParticipation(configuration.quantities, -1),
    ).toThrowError(new MaintenanceError('INVALID_QUANTITIES'));
    expect(assessPlannedParticipation(configuration.quantities, 1)).toBe(
      'below_minimum',
    );
    expect(assessPlannedParticipation(configuration.quantities, 10)).toBeNull();
  });
  it('rejects invalid restored versions and overflow', () => {
    const original = occurrence();
    expect(() =>
      MaintenanceOccurrence.restore({ ...original.toRecord(), version: 0 }),
    ).toThrowError(new MaintenanceError('INVALID_VERSION'));
    expect(() =>
      MaintenanceOccurrence.restore({
        ...original.toRecord(),
        availabilityRevision: 0,
      }),
    ).toThrowError(new MaintenanceError('INVALID_VERSION'));
    const last = MaintenanceOccurrence.restore({
      ...original.toRecord(),
      version: Number.MAX_SAFE_INTEGER,
    });
    expect(() => last.cancel()).toThrowError(
      new MaintenanceError('INVALID_VERSION'),
    );
  });
});
