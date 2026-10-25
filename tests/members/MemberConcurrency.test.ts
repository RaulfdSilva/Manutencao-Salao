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
let environment: MemberTestEnvironment;
let useCases: MemberUseCases;

beforeEach(() => {
  environment = new MemberTestEnvironment();
  environment.seed({ id: 'admin', role: 'administrator' });
  environment.seed({ id: 'admin-b', role: 'administrator' });
  environment.seed({ id: 'target' });
  useCases = new MemberUseCases({
    transactions: environment,
    ids: { next: () => 'generated-id' },
    clock: { now: () => '2026-10-24T21:00:00.000Z' },
  });
});

describe('team privacy regressions', () => {
  it('includes inactive members and their phones only for an active administrator', async () => {
    environment.seed({ id: 'inactive', status: 'inactive' });
    expect(await useCases.get(admin, 'inactive')).toMatchObject({
      status: 'inactive',
      phone: '+5511999990000',
      version: 1,
    });
    const team = await useCases.list(admin);
    expect(team.map((m) => m.id)).toContain('inactive');
    expect(team.every((m) => Object.hasOwn(m, 'phone'))).toBe(true);
  });

  it.each<MemberRole>(['administrator', 'maintenance_manager', 'member'])(
    'denies get and list to an inactive %s',
    async (role) => {
      environment.seed({ id: 'inactive', role, status: 'inactive' });
      const actor = { ...admin, memberId: 'inactive' };
      await expect(useCases.get(actor, 'target')).rejects.toThrowError(
        new MemberOperationError('FORBIDDEN'),
      );
      await expect(useCases.list(actor)).rejects.toThrowError(
        new MemberOperationError('FORBIDDEN'),
      );
    },
  );
});

describe('optimistic concurrency', () => {
  const mutations = [
    {
      name: 'update',
      run: (version: number) =>
        useCases.update(admin, 'target', { name: 'Maria' }, version),
    },
    {
      name: 'changeRole',
      run: (version: number) =>
        useCases.changeRole(admin, 'target', 'maintenance_manager', version),
    },
    {
      name: 'deactivate',
      run: (version: number) => useCases.deactivate(admin, 'target', version),
    },
    {
      name: 'reactivate',
      run: (version: number) => useCases.reactivate(admin, 'target', version),
    },
  ];

  for (const mutation of mutations) {
    it(`rejects stale ${mutation.name} without side effects`, async () => {
      const member = environment.seed({
        id: 'target',
        version: 2,
        status: mutation.name === 'reactivate' ? 'inactive' : 'active',
      });
      await expect(mutation.run(1)).rejects.toThrowError(
        new MemberOperationError('MEMBER_VERSION_CONFLICT'),
      );
      expect(environment.records.get('target')).toBe(member);
      expect(environment.events).toEqual([]);
      expect(environment.releases).toEqual([]);
    });

    it(`rejects a missing expected version in ${mutation.name}`, async () => {
      // Runtime validation protects callers outside TypeScript too.
      await expect(
        mutation.run(undefined as unknown as number),
      ).rejects.toThrowError(new MemberError('INVALID_VERSION'));
      expect(environment.records.get('target')?.version).toBe(1);
      expect(environment.events).toEqual([]);
    });

    it(`handles a storage-level conditional-write rejection in ${mutation.name}`, async () => {
      environment.seed({
        id: 'target',
        status: mutation.name === 'reactivate' ? 'inactive' : 'active',
      });
      const before = environment.records.get('target');
      environment.rejectConditionalSave = true;
      await expect(mutation.run(1)).rejects.toThrowError(
        new MemberOperationError('MEMBER_VERSION_CONFLICT'),
      );
      expect(environment.records.get('target')).toBe(before);
      expect(environment.events).toEqual([]);
      expect(environment.releases).toEqual([]);
    });
  }

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'])(
    'rejects an invalid expected version: %s',
    async (version) => {
      await expect(
        useCases.update(admin, 'target', { name: 'Maria' }, version as number),
      ).rejects.toThrowError(new MemberError('INVALID_VERSION'));
      expect(environment.records.get('target')?.version).toBe(1);
      expect(environment.events).toEqual([]);
    },
  );

  it('does not disclose the version conflict to an unauthorized requester', async () => {
    environment.seed({ id: 'target', version: 10 });
    await expect(
      useCases.update(
        { ...admin, memberId: 'target' },
        'target',
        { name: 'Maria' },
        1,
      ),
    ).rejects.toThrowError(new MemberOperationError('FORBIDDEN'));
  });

  it('prevents the stale-form overwrite reproduced by the audit', async () => {
    const stale = await useCases.get(admin, 'target');
    const winner = await useCases.update(
      { ...admin, memberId: 'admin-b' },
      'target',
      { name: 'Novo nome' },
      stale.version,
    );
    await expect(
      useCases.update(
        admin,
        'target',
        { name: stale.name, phone: null },
        stale.version,
      ),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_VERSION_CONFLICT'));
    const current = await useCases.get(admin, 'target');
    expect(current).toEqual(winner);
    expect(current).toMatchObject({
      name: 'Novo nome',
      phone: '+5511999990000',
      version: 2,
    });
    expect(environment.events).toHaveLength(1);
    const retried = await useCases.update(
      admin,
      'target',
      { name: current.name, phone: null },
      current.version,
    );
    expect(retried).toMatchObject({
      name: 'Novo nome',
      phone: null,
      version: 3,
    });
  });

  it('accepts only one of two simultaneous updates based on the same version', async () => {
    const results = await Promise.allSettled([
      useCases.update(admin, 'target', { name: 'Primeira edição' }, 1),
      useCases.update(
        { ...admin, memberId: 'admin-b' },
        'target',
        { name: 'Segunda edição' },
        1,
      ),
    ]);
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      value: { name: 'Primeira edição', version: 2 },
    });
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'MEMBER_VERSION_CONFLICT' },
    });
    expect(environment.records.get('target')?.name).toBe('Primeira edição');
    expect(environment.events).toHaveLength(1);
    expect(environment.events[0]).toMatchObject({
      before: { version: 1 },
      after: { version: 2 },
    });
  });

  it('invalidates an old profile version after role and status changes too', async () => {
    await useCases.changeRole(admin, 'target', 'maintenance_manager', 1);
    await expect(
      useCases.update(admin, 'target', { name: 'Maria' }, 1),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_VERSION_CONFLICT'));
    await useCases.deactivate(admin, 'target', 2);
    await useCases.reactivate(admin, 'target', 3);
    await expect(
      useCases.update(admin, 'target', { name: 'Maria' }, 2),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_VERSION_CONFLICT'));
    expect(environment.records.get('target')?.version).toBe(4);
    expect(environment.events).toHaveLength(3);
  });

  it('checks stale versions even when the requested values are already current', async () => {
    await useCases.update(admin, 'target', { name: 'Maria' }, 1);
    await expect(
      useCases.update(admin, 'target', { name: 'Maria' }, 1),
    ).rejects.toThrowError(new MemberOperationError('MEMBER_VERSION_CONFLICT'));
    const current = await useCases.update(
      admin,
      'target',
      { name: ' Maria ' },
      2,
    );
    expect(current.version).toBe(2);
    expect(environment.events).toHaveLength(1);
  });

  it('rolls back the advanced version and assignment removal when audit fails', async () => {
    environment.failure = 'audit';
    await expect(useCases.deactivate(admin, 'target', 1)).rejects.toThrowError(
      'Audit unavailable',
    );
    expect(environment.records.get('target')).toMatchObject({
      version: 1,
      status: 'active',
    });
    expect(environment.releases).toEqual([]);
    expect(environment.events).toEqual([]);
    environment.failure = null;
    expect(await useCases.deactivate(admin, 'target', 1)).toMatchObject({
      version: 2,
      status: 'inactive',
    });
  });
});

describe('conditional-save storage contract in the test adapter', () => {
  it('rejects a second write derived from the same stored version without a prior application check', async () => {
    await environment.run(admin.congregationId, async (tx) => {
      const original = await tx.members.findById(
        admin.congregationId,
        'target',
      );
      if (!original) throw new Error('Missing test fixture');
      const first = original.editProfile({ name: 'Primeira edição' });
      const second = original.editProfile({ name: 'Segunda edição' });
      expect(await tx.members.saveIfVersion(first, 1)).toBe(true);
      expect(await tx.members.saveIfVersion(second, 1)).toBe(false);
      expect(
        (await tx.members.findById(admin.congregationId, 'target'))?.name,
      ).toBe('Primeira edição');
    });
  });

  it('requires matching congregation and an existing record', async () => {
    const foreign = environment
      .seed({ id: 'foreign', congregationId: 'other' })
      .deactivate();
    const missing = environment.seed({ id: 'missing' }).deactivate();
    environment.records.delete('missing');
    await environment.run(admin.congregationId, async (tx) => {
      expect(await tx.members.saveIfVersion(foreign, 1)).toBe(false);
      expect(await tx.members.saveIfVersion(missing, 1)).toBe(false);
    });
    expect(environment.records.get('foreign')?.status).toBe('active');
    expect(environment.records.has('missing')).toBe(false);
  });

  it('rejects a payload that does not advance exactly one version', async () => {
    await environment.run(admin.congregationId, async (tx) => {
      const original = await tx.members.findById(
        admin.congregationId,
        'target',
      );
      if (!original) throw new Error('Missing test fixture');
      await expect(tx.members.saveIfVersion(original, 1)).rejects.toThrowError(
        new MemberError('INVALID_VERSION'),
      );
      expect(
        (await tx.members.findById(admin.congregationId, 'target'))?.version,
      ).toBe(1);
    });
  });
});
