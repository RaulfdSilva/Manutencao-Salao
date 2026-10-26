import { describe, expect, it } from 'vitest';
import { ChecklistUseCases } from '../../src/application/checklists/ChecklistUseCases';
import { snapshotInitialCatalog } from '../../src/application/checklists/InitialChecklistCatalog';
import type { InitialChecklistCatalog } from '../../src/application/checklists/InitialChecklistCatalog';
import {
  loadAudioMaintenanceCatalog,
  toInitialChecklistCatalog,
} from '../../src/infrastructure/catalogs/AudioMaintenanceCatalog';
import {
  ChecklistTestEnvironment,
  definitions,
} from '../checklists/ChecklistTestEnvironment';
import { admin, member } from '../availability/AvailabilityTestEnvironment';

const input = () => toInitialChecklistCatalog(loadAudioMaintenanceCatalog());
const provision = (env: ChecklistTestEnvironment, command = env.command()) =>
  env.service.provisionInitialCatalog(admin, input(), command);
function template(env: ChecklistTestEnvironment, category = 'fortnightly') {
  const found = [...env.templates.values()].find(
    (t) =>
      t.toRecord().category === category &&
      t.toRecord().congregationId === 'congregation',
  );
  if (!found) throw new Error('Missing test template');
  return found;
}

describe('explicit initial catalog provisioning', () => {
  it('loading configuration and constructing services do not create storage, people, occurrences or checklists', () => {
    const env = new ChecklistTestEnvironment();
    const members = [...env.members],
      occurrences = [...env.occurrences];
    input();
    new ChecklistUseCases(env.dependencies);
    expect(env.templates.size).toBe(0);
    expect(env.checklists.size).toBe(0);
    expect(env.problems.size).toBe(0);
    expect(env.receipts.size).toBe(0);
    expect(env.checklistEvents).toEqual([]);
    expect([...env.members]).toEqual(members);
    expect([...env.occurrences]).toEqual(occurrences);
  });
  it('creates four existing-model templates, one technical event and an explicit immutable receipt', async () => {
    const env = new ChecklistTestEnvironment();
    const receipt = await provision(env);
    expect(receipt.result.catalogProvisioning).toEqual({
      catalogId: 'audio-maintenance-matrix',
      version: 1,
      areaId: 'audio',
      templates: [
        { category: 'fortnightly', disposition: 'created', version: 1 },
        { category: 'monthly', disposition: 'created', version: 1 },
        { category: 'quarterly', disposition: 'created', version: 1 },
        { category: 'semiannual', disposition: 'created', version: 1 },
      ],
    });
    expect(env.templates.size).toBe(4);
    expect(env.checklists.size).toBe(0);
    expect(env.checklistEvents).toHaveLength(1);
    expect(env.checklistEvents[0]?.kind).toBe('catalog_provisioned');
    expect(JSON.parse(receipt.request).catalog.revisionDate).toBe('2026-05-30');
    expect(Object.isFrozen(receipt.result.catalogProvisioning?.templates)).toBe(
      true,
    );
  });
  it('is idempotent with the same command or different commands and does not duplicate durable events', async () => {
    const env = new ChecklistTestEnvironment();
    const first = await provision(env, 'initial-audio-2026');
    const before = [...env.templates];
    expect(await provision(env, 'initial-audio-2026')).toEqual(first);
    const second = await provision(env);
    expect(
      second.result.catalogProvisioning?.templates.every(
        (t) => t.disposition === 'preserved',
      ),
    ).toBe(true);
    expect([...env.templates]).toEqual(before);
    expect(env.checklistEvents).toHaveLength(1);
  });
  it('preserves existing administrative models, fills only missing ones and supports later explicit administrator edits', async () => {
    const env = new ChecklistTestEnvironment();
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      definitions,
      null,
      env.command(),
    );
    const before = template(env).toRecord();
    const receipt = await provision(env);
    expect(receipt.result.catalogProvisioning?.templates[0]?.disposition).toBe(
      'preserved',
    );
    expect(template(env).toRecord()).toEqual(before);
    expect(env.templates.size).toBe(4);
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      [
        ...definitions,
        { ...definitions[0], taskId: 'synthetic-admin-addition' },
      ],
      1,
      env.command(),
    );
    const revised = template(env).toRecord();
    await provision(env);
    expect(template(env).toRecord()).toEqual(revised);
    expect(revised.version).toBe(2);
  });
  it.each([
    ['fortnightly', 6],
    ['monthly', 15],
    ['quarterly', 12],
    ['semiannual', 17],
  ] as const)(
    'creates %s checklist with %i independent pairs through the real existing use case',
    async (category, count) => {
      const env = new ChecklistTestEnvironment();
      await provision(env);
      const id = `${category}-occurrence`;
      env.seedOccurrence({ id, category });
      await env.service.createChecklist(member, id, 1, env.command());
      const record = env.checklist(id).toRecord();
      expect(record.verifications).toHaveLength(count);
      expect(new Set(record.verifications.map((v) => v.key)).size).toBe(count);
      expect(
        record.verifications.every((v) => v.result.status === 'unfilled'),
      ).toBe(true);
      expect(record.technicalWorkRecorded).toBe(false);
      expect(record.templateVersion).toBe(1);
      expect(record.category).toBe(category);
    },
  );
  it('preserves a materialized snapshot after an administrative edit and after provisioning a new catalog version', async () => {
    const env = new ChecklistTestEnvironment();
    await provision(env, 'bootstrap-official');
    await env.service.createChecklist(member, 'occurrence', 1, env.command());
    const snapshot = env.checklist().toRecord();
    const revised = template(env).toRecord().definitions.slice(0, 1);
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      revised,
      1,
      env.command(),
    );
    await env.service.provisionInitialCatalog(
      admin,
      { ...input(), version: 2 },
      env.command(),
    );
    await provision(env, 'bootstrap-official');
    expect(template(env).toRecord().version).toBe(2);
    expect(template(env).toRecord().definitions).toEqual(revised);
    expect(env.checklist().toRecord()).toEqual(snapshot);
    env.seedOccurrence({ id: 'new-occurrence' });
    await env.service.createChecklist(
      member,
      'new-occurrence',
      1,
      env.command(),
    );
    expect(env.checklist('new-occurrence').toRecord().templateVersion).toBe(2);
    expect(
      env.checklist('new-occurrence').toRecord().verifications,
    ).toHaveLength(1);
  });
  it.each(['member', 'manager', 'inactive', 'foreign', 'missing'])(
    'denies provisioning by %s before effects',
    async (memberId) => {
      const env = new ChecklistTestEnvironment();
      await expect(
        env.service.provisionInitialCatalog(
          { ...admin, memberId },
          input(),
          env.command(),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(env.templates.size).toBe(0);
      expect(env.receipts.size).toBe(0);
      expect(env.checklistEvents).toEqual([]);
    },
  );
  it('revalidates admin status on replay, rather than treating command identity as authorization', async () => {
    const env = new ChecklistTestEnvironment();
    await provision(env, 'known-command');
    env.seedMember({ id: 'admin', role: 'member' });
    await expect(provision(env, 'known-command')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    env.seedMember({ id: 'admin', role: 'administrator', status: 'inactive' });
    await expect(provision(env, 'known-command')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('rejects command identity reused for changed configuration instead of silently changing templates', async () => {
    const env = new ChecklistTestEnvironment();
    await provision(env, 'same-command');
    const before = [...env.templates];
    await expect(
      env.service.provisionInitialCatalog(
        admin,
        { ...input(), version: 2 },
        'same-command',
      ),
    ).rejects.toMatchObject({ code: 'COMMAND_ID_REUSED' });
    expect([...env.templates]).toEqual(before);
  });
  it.each(['event', 'receipt', 'insert-cas'] as const)(
    'rolls back all four initial models and events on %s failure',
    async (failure) => {
      const env = new ChecklistTestEnvironment();
      env.failChecklistEvents = failure === 'event';
      env.failReceipts = failure === 'receipt';
      const service =
        failure === 'insert-cas'
          ? new ChecklistUseCases({
              ...env.dependencies,
              transactions: {
                run: (scope, work) =>
                  env.runChecklist(scope, (tx) =>
                    work({
                      ...tx,
                      templates: {
                        ...tx.templates,
                        insertIfAbsent: (model) =>
                          model.toRecord().category === 'quarterly'
                            ? Promise.resolve(false)
                            : tx.templates.insertIfAbsent(model),
                      },
                    }),
                  ),
              },
            })
          : env.service;
      await expect(
        service.provisionInitialCatalog(admin, input(), env.command()),
      ).rejects.toThrow();
      expect(env.templates.size).toBe(0);
      expect(env.receipts.size).toBe(0);
      expect(env.checklistEvents).toEqual([]);
    },
  );
  it('serializes concurrent provision attempts and produces no duplicate model or event', async () => {
    const env = new ChecklistTestEnvironment();
    const results = await Promise.all([provision(env), provision(env)]);
    expect(env.templates.size).toBe(4);
    expect(
      results[0]?.result.catalogProvisioning?.templates.every(
        (t) => t.disposition === 'created',
      ),
    ).toBe(true);
    expect(
      results[1]?.result.catalogProvisioning?.templates.every(
        (t) => t.disposition === 'preserved',
      ),
    ).toBe(true);
    expect(env.checklistEvents).toHaveLength(1);
  });
  it.each(['edit-first', 'provision-first'] as const)(
    'never overwrites an administrator revision during %s concurrency',
    async (order) => {
      const env = new ChecklistTestEnvironment();
      const edit = () =>
        env.service.saveTemplate(
          admin,
          'fortnightly',
          definitions,
          null,
          env.command(),
        );
      const operations =
        order === 'edit-first'
          ? [edit, () => provision(env)]
          : [() => provision(env), edit];
      const results = await Promise.allSettled(operations.map((run) => run()));
      expect(results[0]?.status).toBe('fulfilled');
      if (order === 'edit-first') {
        expect(results[1]?.status).toBe('fulfilled');
        expect(template(env).toRecord().definitions).toEqual(definitions);
      } else {
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { code: 'VERSION_CONFLICT' },
        });
        expect(template(env).toRecord().definitions).toHaveLength(6);
      }
    },
  );
  it('isolates models and idempotency receipts by congregation', async () => {
    const env = new ChecklistTestEnvironment();
    await provision(env, 'same-initial-command');
    env.seedMember({
      id: 'foreign-admin',
      congregationId: 'foreign',
      role: 'administrator',
    });
    await env.service.provisionInitialCatalog(
      { congregationId: 'foreign', memberId: 'foreign-admin' },
      input(),
      'same-initial-command',
    );
    expect(env.templates.size).toBe(8);
    expect(
      new Set(
        [...env.templates.values()].map((t) => t.toRecord().congregationId),
      ),
    ).toEqual(new Set(['congregation', 'foreign']));
    expect(env.receipts.size).toBe(2);
  });
  it('rejects unsupported areas and malformed categories and pairs at the inner boundary', () => {
    const catalog = input();
    const invalidArea: InitialChecklistCatalog = JSON.parse(
      JSON.stringify({ ...catalog, areaId: 'video' }),
    );
    expect(() => snapshotInitialCatalog(invalidArea)).toThrow(
      'INVALID_CATALOG',
    );
    expect(() => snapshotInitialCatalog({ ...catalog, templates: [] })).toThrow(
      'INVALID_CATALOG',
    );
    const first = catalog.templates[0];
    if (!first) throw new Error('Missing test template');
    expect(() =>
      snapshotInitialCatalog({
        ...catalog,
        templates: [first, first, first, first],
      }),
    ).toThrow('INVALID_CATALOG');
  });
});
