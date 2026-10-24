import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole } from '../../src/domain/members/Member';
import { MemberError } from '../../src/domain/members/MemberError';
import type { MemberActor } from '../../src/application/members/MemberContracts';
import { MemberOperationError } from '../../src/application/members/MemberOperationError';
import { MemberUseCases } from '../../src/application/members/MemberUseCases';
import { MemberTestEnvironment } from './MemberTestEnvironment';

const admin: MemberActor = {
  memberId: 'admin',
  congregationId: 'congregation-1',
};
const now = '2026-10-24T21:00:00.000Z';
let environment: MemberTestEnvironment;
let useCases: MemberUseCases;

beforeEach(() => {
  environment = new MemberTestEnvironment();
  environment.seed({ id: 'admin', role: 'administrator' });
  environment.seed({ id: 'target' });
  useCases = new MemberUseCases({
    transactions: environment,
    ids: { next: () => 'generated-id' },
    clock: { now: () => now },
  });
});

describe('member registration and queries', () => {
  it('ignores client-supplied identity, congregation and state during creation', async () => {
    const input = {
      id: 'admin',
      congregationId: 'other',
      status: 'inactive',
      name: 'João',
      role: 'member' as const,
    };
    expect(await useCases.create(admin, input)).toMatchObject({
      id: 'generated-id',
      congregationId: admin.congregationId,
      status: 'active',
    });
    expect(environment.records.get('admin')?.role).toBe('administrator');
  });

  it('creates an active member with a generated identity and an audit event without personal data', async () => {
    const member = await useCases.create(admin, {
      name: ' João ',
      role: 'member',
    });
    expect(member).toEqual({
      id: 'generated-id',
      congregationId: admin.congregationId,
      name: 'João',
      phone: null,
      role: 'member',
      status: 'active',
    });
    expect(environment.events).toEqual([
      {
        actorId: 'admin',
        congregationId: admin.congregationId,
        memberId: 'generated-id',
        occurredAt: now,
        action: 'created',
        before: null,
        after: { role: 'member', status: 'active' },
      },
    ]);
  });

  it('does not permit creation of the first administrator through ordinary registration', async () => {
    environment.records.clear();
    await expect(
      useCases.create(admin, { name: 'Admin', role: 'administrator' }),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
    expect(environment.records.size).toBe(0);
  });

  it('rejects duplicate identifiers instead of overwriting a member', async () => {
    const original = environment.seed({
      id: 'generated-id',
      congregationId: 'other',
    });
    await expect(
      useCases.create(admin, { name: 'Outra pessoa', role: 'member' }),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_ALREADY_EXISTS'));
    expect(environment.records.get('generated-id')).toBe(original);
    expect(environment.events).toEqual([]);
  });

  it('rejects invalid creation without persisting or auditing', async () => {
    await expect(
      useCases.create(admin, { name: ' ', role: 'member' }),
    ).rejects.toThrowError(new MemberError('INVALID_NAME'));
    expect(environment.records.size).toBe(2);
    expect(environment.events).toEqual([]);
  });

  it('allows administrators to view phone numbers and list their congregation only', async () => {
    environment.seed({ id: 'foreign', congregationId: 'other' });
    expect(await useCases.get(admin, 'target')).toHaveProperty(
      'phone',
      '+5511999990000',
    );
    expect((await useCases.list(admin)).map((m) => m.id)).toEqual([
      'admin',
      'target',
    ]);
    await expect(useCases.get(admin, 'foreign')).rejects.toThrowError(
      new MemberOperationError('MEMBER_NOT_FOUND'),
    );
  });

  it.each<MemberRole>(['member', 'maintenance_manager'])(
    'omits the phone property entirely for %s viewing their own record',
    async (role) => {
      environment.seed({ id: 'target', role });
      const actor = { ...admin, memberId: 'target' };
      const view = await useCases.get(actor, 'target');
      expect(view).not.toHaveProperty('phone');
      expect(JSON.stringify(view)).not.toContain('+5511999990000');
      await expect(useCases.get(actor, 'admin')).rejects.toThrowError(
        new MemberOperationError('FORBIDDEN'),
      );
      await expect(useCases.list(actor)).rejects.toThrowError(
        new MemberOperationError('FORBIDDEN'),
      );
    },
  );
});

describe('authorization', () => {
  const operations = [
    {
      name: 'create',
      run: (actor: MemberActor) =>
        useCases.create(actor, { name: 'João', role: 'member' }),
    },
    {
      name: 'update',
      run: (actor: MemberActor) =>
        useCases.update(actor, 'target', { name: 'João' }),
    },
    {
      name: 'changeRole',
      run: (actor: MemberActor) =>
        useCases.changeRole(actor, 'target', 'administrator'),
    },
    {
      name: 'deactivate',
      run: (actor: MemberActor) => useCases.deactivate(actor, 'target'),
    },
    {
      name: 'reactivate',
      run: (actor: MemberActor) => useCases.reactivate(actor, 'target'),
    },
  ];
  const identities = [
    {
      name: 'member',
      id: 'ordinary',
      role: 'member' as const,
      status: 'active' as const,
    },
    {
      name: 'maintenance manager',
      id: 'manager',
      role: 'maintenance_manager' as const,
      status: 'active' as const,
    },
    {
      name: 'inactive administrator',
      id: 'inactive',
      role: 'administrator' as const,
      status: 'inactive' as const,
    },
  ];
  for (const operation of operations) {
    for (const identity of identities) {
      it(`denies ${operation.name} to ${identity.name} without side effects`, async () => {
        environment.seed(identity);
        const before = new Map(environment.records);
        await expect(
          operation.run({ ...admin, memberId: identity.id }),
        ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
        expect(environment.records).toEqual(before);
        expect(environment.events).toEqual([]);
        expect(environment.releases).toEqual([]);
      });
    }
  }

  it('reads current authority instead of accepting a claimed administrator role', async () => {
    environment.seed({ id: 'admin', role: 'member' });
    await expect(
      useCases.create(admin, { name: 'João', role: 'member' }),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
  });

  it('denies a missing actor or a valid actor presented in another congregation', async () => {
    await expect(
      useCases.get({ ...admin, memberId: 'missing' }, 'target'),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
    await expect(
      useCases.list({ ...admin, congregationId: 'other' }),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
  });

  it('denies reads by inactive members', async () => {
    environment.seed({ id: 'target', status: 'inactive' });
    await expect(
      useCases.get({ ...admin, memberId: 'target' }, 'target'),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
  });
});

describe('profile, role and state changes', () => {
  it('does not accept role, identity or state changes through profile editing', async () => {
    const input = {
      name: 'Maria',
      id: 'admin',
      congregationId: 'other',
      role: 'administrator',
      status: 'inactive',
    };
    expect(await useCases.update(admin, 'target', input)).toMatchObject({
      id: 'target',
      congregationId: admin.congregationId,
      role: 'member',
      status: 'active',
    });
  });

  it('rejects a role outside the approved set without side effects', async () => {
    await expect(
      useCases.changeRole(admin, 'target', 'owner' as MemberRole),
    ).rejects.toThrowError(new MemberError('INVALID_ROLE'));
    expect(environment.records.get('target')?.role).toBe('member');
    expect(environment.events).toEqual([]);
  });

  it('does not mutate members in another congregation', async () => {
    const member = environment.seed({ id: 'foreign', congregationId: 'other' });
    await expect(
      useCases.update(admin, 'foreign', { name: 'Outra' }),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_NOT_FOUND'));
    await expect(
      useCases.changeRole(admin, 'foreign', 'administrator'),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_NOT_FOUND'));
    await expect(useCases.deactivate(admin, 'foreign')).rejects.toThrowError(
      new MemberOperationError('MEMBER_NOT_FOUND'),
    );
    await expect(useCases.reactivate(admin, 'foreign')).rejects.toThrowError(
      new MemberOperationError('MEMBER_NOT_FOUND'),
    );
    expect(environment.records.get('foreign')).toBe(member);
    expect(environment.events).toEqual([]);
    expect(environment.releases).toEqual([]);
  });

  it('edits profile without changing identity, role or state; preserves then clears phone', async () => {
    const edited = await useCases.update(admin, 'target', { name: 'Maria' });
    expect(edited).toEqual({
      id: 'target',
      congregationId: admin.congregationId,
      name: 'Maria',
      phone: '+5511999990000',
      role: 'member',
      status: 'active',
    });
    expect(
      await useCases.update(admin, 'target', { name: 'Maria', phone: null }),
    ).toHaveProperty('phone', null);
    expect(environment.events.map((e) => e.action)).toEqual([
      'profile_updated',
      'profile_updated',
    ]);
  });

  it('rejects invalid edits and unknown targets without modifying data', async () => {
    const before = environment.records.get('target');
    await expect(
      useCases.update(admin, 'target', { name: ' ' }),
    ).rejects.toThrowError(new MemberError('INVALID_NAME'));
    await expect(
      useCases.update(admin, 'missing', { name: 'Maria' }),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_NOT_FOUND'));
    expect(environment.records.get('target')).toBe(before);
    expect(environment.events).toEqual([]);
  });

  it('changes one role without changing the member identity or state', async () => {
    expect(
      await useCases.changeRole(admin, 'target', 'maintenance_manager'),
    ).toMatchObject({
      id: 'target',
      role: 'maintenance_manager',
      status: 'active',
    });
    expect(environment.events[0]).toMatchObject({
      action: 'role_changed',
      before: { role: 'member', status: 'active' },
      after: { role: 'maintenance_manager', status: 'active' },
    });
  });

  it.each(['deactivate', 'demote'] as const)(
    'does not %s the last active administrator, even with inactive/foreign administrators',
    async (operation) => {
      environment.seed({
        id: 'inactive-admin',
        role: 'administrator',
        status: 'inactive',
      });
      environment.seed({
        id: 'foreign-admin',
        congregationId: 'other',
        role: 'administrator',
      });
      const result =
        operation === 'deactivate'
          ? useCases.deactivate(admin, 'admin')
          : useCases.changeRole(admin, 'admin', 'member');
      await expect(result).rejects.toThrowError(
        new MemberOperationError('LAST_ACTIVE_ADMINISTRATOR'),
      );
      expect(environment.records.get('admin')?.isActiveAdministrator).toBe(
        true,
      );
      expect(environment.releases).toEqual([]);
      expect(environment.events).toEqual([]);
    },
  );

  it.each(['deactivate', 'demote'] as const)(
    'can %s an administrator when another remains, without leaking phone on the response',
    async (operation) => {
      environment.seed({ id: 'second-admin', role: 'administrator' });
      const view = await (operation === 'deactivate'
        ? useCases.deactivate(admin, 'admin')
        : useCases.changeRole(admin, 'admin', 'member'));
      expect(view).not.toHaveProperty('phone');
      expect(
        environment.records.get('second-admin')?.isActiveAdministrator,
      ).toBe(true);
    },
  );

  it('requests assignment removal and an audit in the same deactivation operation, retaining the member identity', async () => {
    const before = environment.records.get('target');
    expect(await useCases.deactivate(admin, 'target')).toMatchObject({
      id: 'target',
      status: 'inactive',
    });
    expect(environment.records.size).toBe(2);
    expect(environment.records.get('target')?.id).toBe(before?.id);
    expect(environment.releases).toEqual([
      {
        congregationId: admin.congregationId,
        memberId: 'target',
        actorId: 'admin',
        effectiveAt: now,
      },
    ]);
    expect(environment.events[0]).toMatchObject({
      action: 'deactivated',
      occurredAt: now,
      before: { status: 'active' },
      after: { status: 'inactive' },
    });
    await useCases.deactivate(admin, 'target');
    expect(environment.releases).toHaveLength(1);
    expect(environment.events).toHaveLength(1);
  });

  it('reactivates eligibility without invoking assignment restoration or any device operation', async () => {
    await useCases.deactivate(admin, 'target');
    const member = await useCases.reactivate(admin, 'target');
    expect(member).toMatchObject({
      id: 'target',
      role: 'member',
      status: 'active',
    });
    expect(environment.releases).toHaveLength(1);
    expect(environment.events.map((e) => e.action)).toEqual([
      'deactivated',
      'reactivated',
    ]);
    await useCases.reactivate(admin, 'target');
    expect(environment.events).toHaveLength(2);
  });

  it('does not write or audit unchanged profile or role', async () => {
    await useCases.update(admin, 'target', { name: 'Ana Silva' });
    await useCases.changeRole(admin, 'target', 'member');
    expect(environment.events).toEqual([]);
  });

  it.each(['save', 'release', 'audit'] as const)(
    'propagates %s failures and exercises rollback in the test adapter',
    async (failure) => {
      environment.failure = failure;
      await expect(useCases.deactivate(admin, 'target')).rejects.toThrowError(
        'unavailable',
      );
      expect(environment.records.get('target')?.status).toBe('active');
      expect(environment.releases).toEqual([]);
      expect(environment.events).toEqual([]);
    },
  );

  it('rolls back registration when audit cannot be written', async () => {
    environment.failure = 'audit';
    await expect(
      useCases.create(admin, { name: 'João', role: 'member' }),
    ).rejects.toThrowError('Audit unavailable');
    expect(environment.records.has('generated-id')).toBe(false);
  });

  it('rejects a competing removal of the last administrator under the test transaction serialization', async () => {
    environment.seed({ id: 'second-admin', role: 'administrator' });
    const results = await Promise.allSettled([
      useCases.deactivate(admin, 'admin'),
      useCases.deactivate(
        { ...admin, memberId: 'second-admin' },
        'second-admin',
      ),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'LAST_ACTIVE_ADMINISTRATOR' },
    });
    expect(
      [...environment.records.values()].filter((m) => m.isActiveAdministrator),
    ).toHaveLength(1);
    expect(environment.events).toHaveLength(1);
  });
});
