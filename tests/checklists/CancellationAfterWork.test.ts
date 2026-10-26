import { describe, expect, it } from 'vitest';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import { MaintenanceChecklist } from '../../src/domain/checklists/MaintenanceChecklist';
import { TechnicalProblem } from '../../src/domain/checklists/TechnicalProblem';
import { ChecklistTestEnvironment, firstKey } from './ChecklistTestEnvironment';
import {
  admin,
  manager,
  member,
  deadline,
} from '../availability/AvailabilityTestEnvironment';
import type { VerificationInput } from '../../src/domain/checklists/ChecklistTypes';

function occurrence(env: ChecklistTestEnvironment) {
  const occurrence = env.occurrences.get('occurrence');
  if (!occurrence) throw new Error('Missing test occurrence');
  return occurrence;
}
function fill(
  env: ChecklistTestEnvironment,
  input: VerificationInput = { status: 'completed' },
) {
  return env.service.recordResult(
    member,
    'occurrence',
    firstKey,
    input,
    env.checklist().toRecord().version,
    occurrence(env).version,
    env.command(),
  );
}
function cancel(env: ChecklistTestEnvironment) {
  return env.maintenanceService.cancel(
    admin,
    'occurrence',
    occurrence(env).version,
  );
}
function snapshot(env: ChecklistTestEnvironment) {
  return {
    occurrence: occurrence(env).toRecord(),
    checklists: [...env.checklists],
    problems: [...env.problems],
    annual: [...env.annual],
    disposals: [...env.disposals],
    plans: [...env.plans],
    jobs: [...env.jobs],
    events: [...env.events],
    maintenanceEvents: [...env.maintenanceEvents],
    checklistEvents: [...env.checklistEvents],
    receipts: [...env.receipts],
  };
}

describe('cancellation after recorded technical work', () => {
  it('cancels without a checklist, retaining normal availability disposal and technical history', async () => {
    const env = new ChecklistTestEnvironment();
    await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
    expect((await cancel(env)).status).toBe('cancelled');
    expect(env.checklists.size).toBe(0);
    expect(env.disposals.size).toBe(1);
    expect(env.plans.size).toBe(0);
    expect([...env.annual.values()][0]?.status).toBe('cancelled');
  });

  it('creating and reading an empty checklist, even with occasional definitions, does not start work', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    await env.service.addOccasional(
      manager,
      'occurrence',
      {
        taskId: 'synthetic-occasional',
        taskDescription: 'Verificação sintética ocasional',
        equipmentCategoryId: 'synthetic-category',
        equipmentCategoryName: 'Categoria sintética',
      },
      1,
      1,
      env.command(),
    );
    await env.service.getChecklist(member, 'occurrence');
    await fill(env, { status: 'unfilled' });
    expect(env.checklist().toRecord().technicalWorkRecorded).toBe(false);
    expect((await cancel(env)).status).toBe('cancelled');
    await expect(fill(env)).rejects.toMatchObject({
      code: 'OCCURRENCE_CANCELLED',
    });
  });

  it.each(['completed', 'not_applicable', 'problem_found'] as const)(
    'blocks cancellation after the first %s result without changing occurrence, annual history or availability',
    async (status) => {
      const env = new ChecklistTestEnvironment();
      await env.setup();
      await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
      await fill(
        env,
        status === 'problem_found'
          ? { status, description: 'Problema técnico sintético' }
          : { status },
      );
      const before = snapshot(env);
      await expect(cancel(env)).rejects.toMatchObject({
        code: 'TECHNICAL_WORK_RECORDED',
      });
      expect(snapshot(env)).toEqual(before);
    },
  );

  it('returning a previously completed verification to unfilled never erases the start fact, including after restore', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    await fill(env);
    await fill(env, { status: 'unfilled' });
    expect(env.checklist().summary().counts.unfilled).toBe(2);
    const restored = MaintenanceChecklist.restore(env.checklist().toRecord());
    expect(restored.toRecord().technicalWorkRecorded).toBe(true);
    await expect(cancel(env)).rejects.toMatchObject({
      code: 'TECHNICAL_WORK_RECORDED',
    });
  });

  it.each(['pending', 'resolved'] as const)(
    'a %s problem still blocks cancellation after the result is cleared',
    async (status) => {
      const env = new ChecklistTestEnvironment();
      await env.setup();
      const receipt = await fill(env, {
        status: 'problem_found',
        description: 'Problema sintético',
      });
      const id = receipt.result.problemId;
      if (!id) throw new Error('Missing test problem');
      await fill(env, { status: 'unfilled' });
      if (status === 'resolved')
        await env.service.resolveProblem(manager, id, 1, env.command());
      expect(
        (await env.service.listProblems(admin, 'occurrence', false))[0]?.status,
      ).toBe(status);
      await expect(cancel(env)).rejects.toMatchObject({
        code: 'TECHNICAL_WORK_RECORDED',
      });
    },
  );

  it('queries independent stored problems rather than relying only on the checklist marker', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    // Restored historical evidence exercises the problem-store branch of the contract;
    // this is not an additional product flow for creating problems.
    await env.runChecklist('congregation', (tx) =>
      tx.problems.insert(
        TechnicalProblem.create({
          id: 'historical-problem',
          congregationId: 'congregation',
          occurrenceId: 'occurrence',
          verificationKey: firstKey,
          description: 'Problema histórico sintético',
          photoReference: null,
          recordedAt: env.now,
        }),
      ),
    );
    expect(env.checklist().toRecord().technicalWorkRecorded).toBe(false);
    await expect(cancel(env)).rejects.toMatchObject({
      code: 'TECHNICAL_WORK_RECORDED',
    });
  });

  it.each([
    ['result-first', 'completed'],
    ['cancel-first', 'completed'],
    ['result-first', 'problem_found'],
    ['cancel-first', 'problem_found'],
  ] as const)(
    'serializes %s with %s without committing incompatible states',
    async (order, status) => {
      const env = new ChecklistTestEnvironment();
      await env.setup();
      const record = () =>
        fill(
          env,
          status === 'problem_found'
            ? { status, description: 'Problema sintético concorrente' }
            : { status },
        );
      const operations =
        order === 'result-first'
          ? [record, () => cancel(env)]
          : [() => cancel(env), record];
      const results = await Promise.allSettled(operations.map((run) => run()));
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: {
          code:
            order === 'result-first'
              ? 'TECHNICAL_WORK_RECORDED'
              : 'OCCURRENCE_CANCELLED',
        },
      });
      expect(env.problems.size).toBe(
        order === 'result-first' && status === 'problem_found' ? 1 : 0,
      );
      const started = env.checklist().toRecord().technicalWorkRecorded;
      expect(started).toBe(order === 'result-first');
      expect(occurrence(env).toRecord().status).toBe(
        started ? 'scheduled' : 'cancelled',
      );
    },
  );

  it('an unsuccessful result transaction rolls back the start marker and allows a subsequent valid cancellation', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    const before = snapshot(env);
    env.failReceipts = true;
    await expect(
      fill(env, { status: 'problem_found', description: 'Problema sintético' }),
    ).rejects.toThrow('Receipt storage failed');
    expect(snapshot(env)).toEqual(before);
    env.failReceipts = false;
    expect((await cancel(env)).status).toBe('cancelled');
  });

  it.each([
    'history-read',
    'occurrence-cas',
    'retention',
    'event',
    'annual',
  ] as const)(
    'fails closed and rolls back cancellation on %s failure',
    async (failure) => {
      const env = new ChecklistTestEnvironment();
      await env.setup();
      await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
      const before = snapshot(env);
      env.failTechnicalWorkRead = failure === 'history-read';
      env.rejectOccurrenceSave = failure === 'occurrence-cas';
      env.failDisposal = failure === 'retention';
      env.failEvents = failure === 'event';
      env.failAnnual = failure === 'annual';
      await expect(cancel(env)).rejects.toThrow();
      expect(snapshot(env)).toEqual(before);
    },
  );

  it.each(['admin', 'manager'])(
    '%s can conclude interrupted work with missing checks and open problems without resolving them',
    async (memberId) => {
      const env = new ChecklistTestEnvironment();
      await env.setup();
      await fill(env, {
        status: 'problem_found',
        description: 'Problema sintético',
      });
      await expect(cancel(env)).rejects.toMatchObject({
        code: 'TECHNICAL_WORK_RECORDED',
      });
      await env.service.complete(
        { ...admin, memberId },
        'occurrence',
        env.checklist().toRecord().version,
        1,
        env.command(),
      );
      expect(occurrence(env).toRecord().status).toBe('completed');
      expect(env.checklist().summary().counts.unfilled).toBe(1);
      expect(
        (await env.service.listProblems(admin, 'occurrence'))[0]?.status,
      ).toBe('pending');
      await expect(
        env.service.complete(
          admin,
          'occurrence',
          env.checklist().toRecord().version,
          occurrence(env).version,
          env.command(),
        ),
      ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
      expect(env.completionWrites).toBe(1);
    },
  );

  it('preserves administrator-only cancellation, rejects stale versions and does not leak another congregation work history', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    await expect(
      env.maintenanceService.cancel(manager, 'occurrence', 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      env.maintenanceService.cancel(admin, 'occurrence', 2),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await env.runChecklist('foreign', (tx) =>
      tx.problems.insert(
        TechnicalProblem.create({
          id: 'foreign-problem',
          congregationId: 'foreign',
          occurrenceId: 'occurrence',
          verificationKey: firstKey,
          description: 'Problema sintético isolado',
          photoReference: null,
          recordedAt: env.now,
        }),
      ),
    );
    expect((await cancel(env)).status).toBe('cancelled');
  });

  it('does not silently change the existing resolution policy for legacy cancelled occurrences with problems', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    const receipt = await fill(env, {
      status: 'problem_found',
      description: 'Problema sintético legado',
    });
    const id = receipt.result.problemId;
    if (!id) throw new Error('Missing test problem');
    // Simulate an already stored cancellation from before this policy, not a new cancellation flow.
    env.replaceOccurrence(
      MaintenanceOccurrence.restore({
        ...occurrence(env).toRecord(),
        status: 'cancelled',
        version: occurrence(env).version + 1,
      }),
    );
    await expect(
      env.service.resolveProblem(admin, id, 1, env.command()),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_CANCELLED' });
    expect(
      (await env.service.listProblems(admin, 'occurrence'))[0]?.status,
    ).toBe('pending');
  });

  it('does not reset persisted work history through repository CAS even when all current results are unfilled', async () => {
    const env = new ChecklistTestEnvironment();
    await env.setup();
    await fill(env);
    await fill(env, { status: 'unfilled' });
    const current = env.checklist().toRecord();
    const forged = MaintenanceChecklist.restore({
      ...current,
      technicalWorkRecorded: false,
      version: current.version + 1,
    });
    await expect(
      env.runChecklist('congregation', (tx) =>
        tx.checklists.saveIfVersion(forged, current.version),
      ),
    ).rejects.toThrow('Wrong checklist version/source');
    expect(env.checklist().toRecord()).toEqual(current);
  });
});
