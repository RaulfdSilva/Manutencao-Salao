import { beforeEach, describe, expect, it } from 'vitest';
import {
  admin,
  manager,
  member,
  deadline,
} from '../availability/AvailabilityTestEnvironment';
import {
  ChecklistTestEnvironment,
  definitions,
  firstKey,
  secondKey,
} from './ChecklistTestEnvironment';
import type { VerificationInput } from '../../src/domain/checklists/ChecklistTypes';
import { MaintenanceChecklist } from '../../src/domain/checklists/MaintenanceChecklist';
let env: ChecklistTestEnvironment;
function occurrence() {
  const value = env.occurrences.get('occurrence');
  if (!value) throw new Error('Missing occurrence');
  return value;
}
function version() {
  return env.checklist().toRecord().version;
}
async function fill(
  input: VerificationInput = { status: 'completed' },
  key = firstKey,
  actor = member,
) {
  return env.service.recordResult(
    actor,
    'occurrence',
    key,
    input,
    version(),
    occurrence().version,
    env.command(),
  );
}
async function complete() {
  return env.service.complete(
    manager,
    'occurrence',
    version(),
    occurrence().version,
    env.command(),
  );
}
async function problem() {
  const result = await fill({
    status: 'problem_found',
    description: 'Falha sintética',
    photoReference: 'future-photo',
  });
  if (!result.result.problemId) throw new Error('Missing problem');
  return result.result.problemId;
}
beforeEach(() => {
  env = new ChecklistTestEnvironment();
});

describe('checklist templates and initialization', () => {
  it('requires configured data instead of inventing a maintenance catalog', async () => {
    await expect(
      env.service.createChecklist(member, 'occurrence', 1, env.command()),
    ).rejects.toMatchObject({ code: 'TEMPLATE_NOT_CONFIGURED' });
    expect(env.checklists.size).toBe(0);
  });
  it.each(['fortnightly', 'monthly', 'quarterly', 'semiannual'] as const)(
    'creates only the configured %s snapshot',
    async (category) => {
      env.seedOccurrence({ category });
      await env.service.saveTemplate(
        admin,
        category,
        definitions,
        null,
        env.command(),
      );
      await env.service.createChecklist(member, 'occurrence', 1, env.command());
      expect(env.checklist().toRecord()).toMatchObject({
        category,
        templateVersion: 1,
        version: 1,
      });
      expect(env.checklist().summary().counts.unfilled).toBe(2);
      expect(
        env
          .checklist()
          .toRecord()
          .verifications.every((v) => v.origin === 'recurring'),
      ).toBe(true);
    },
  );
  it.each(['manager', 'member', 'inactive', 'foreign'] as const)(
    'denies recurring model updates to %s',
    async (memberId) => {
      await expect(
        env.service.saveTemplate(
          { ...admin, memberId },
          'fortnightly',
          definitions,
          null,
          env.command(),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(env.templates.size).toBe(0);
    },
  );
  it('preserves created snapshots after recurring edits and uses new defaults for a new occurrence', async () => {
    await env.setup();
    const original = env.checklist();
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      [...definitions, { ...definitions[0], taskId: 'synthetic-extra' }],
      1,
      env.command(),
    );
    expect(env.checklist()).toBe(original);
    env.seedOccurrence({ id: 'next' });
    await env.service.createChecklist(member, 'next', 1, env.command());
    expect(env.checklist('next').toRecord()).toMatchObject({
      templateVersion: 2,
    });
    expect(env.checklist('next').toRecord().verifications).toHaveLength(3);
  });
  it('reading a checklist never records a result or changes its version', async () => {
    await env.setup();
    const before = env.checklist(),
      events = [...env.checklistEvents];
    await env.service.getChecklist(member, 'occurrence');
    await env.service.getChecklist(manager, 'occurrence');
    expect(env.checklist()).toBe(before);
    expect(env.checklistEvents).toEqual(events);
    expect(before.summary().counts.unfilled).toBe(2);
  });
  it('creates only one checklist during repeated or concurrent initialization', async () => {
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      definitions,
      null,
      env.command(),
    );
    await Promise.all([
      env.service.createChecklist(member, 'occurrence', 1, env.command()),
      env.service.createChecklist(manager, 'occurrence', 1, env.command()),
    ]);
    expect(env.checklists.size).toBe(1);
    expect(
      env.checklistEvents.filter((e) => e.kind === 'checklist_created'),
    ).toHaveLength(1);
  });
  it('supports occasional checks from manager/admin without modifying recurring templates', async () => {
    await env.setup();
    const templates = [...env.templates.values()].map((t) => t.toRecord());
    await env.service.addOccasional(
      manager,
      'occurrence',
      { ...definitions[0], taskId: 'synthetic-occasional' },
      version(),
      1,
      env.command(),
    );
    await env.service.addOccasional(
      admin,
      'occurrence',
      { ...definitions[0], taskId: 'synthetic-extra' },
      version(),
      1,
      env.command(),
    );
    expect(env.checklist().toRecord().verifications).toHaveLength(4);
    expect([...env.templates.values()].map((t) => t.toRecord())).toEqual(
      templates,
    );
    await expect(
      env.service.addOccasional(
        member,
        'occurrence',
        { ...definitions[0], taskId: 'unauthorized' },
        version(),
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rejects stale template versions and scoped CAS refusal', async () => {
    await env.setup();
    const changed = [
      ...definitions,
      { ...definitions[0], taskId: 'synthetic-extra' },
    ];
    env.rejectTemplateSave = true;
    await expect(
      env.service.saveTemplate(admin, 'fortnightly', changed, 1, env.command()),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    env.rejectTemplateSave = false;
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      changed,
      1,
      env.command(),
    );
    await expect(
      env.service.saveTemplate(
        admin,
        'fortnightly',
        definitions,
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});

describe('results, issues and authorization', () => {
  it.each(['admin', 'manager', 'member', 'other'])(
    'allows active open participation for %s without availability response',
    async (memberId) => {
      await env.setup();
      await fill({ status: 'completed' }, firstKey, { ...admin, memberId });
      expect(env.checklist().verification(firstKey).result.status).toBe(
        'completed',
      );
      expect(env.plans.size).toBe(0);
    },
  );
  it.each(['admin', 'manager', 'member'])(
    'allows designated participant or implicitly authorized administrator/manager %s',
    async (memberId) => {
      env.replaceOccurrence(
        occurrence()
          .configure({
            ...occurrence().toRecord().configuration,
            participationMode: 'assigned',
          })
          .assignTeam(['member']),
      );
      await env.setup();
      await fill({ status: 'completed' }, firstKey, { ...admin, memberId });
      expect(env.checklist().verification(firstKey).result.status).toBe(
        'completed',
      );
    },
  );
  it.each(['other', 'inactive', 'foreign', 'missing'])(
    'denies assigned/inactive/cross-scope write by %s',
    async (memberId) => {
      env.replaceOccurrence(
        occurrence()
          .configure({
            ...occurrence().toRecord().configuration,
            participationMode: 'assigned',
          })
          .assignTeam(['member']),
      );
      await env.setup();
      await expect(
        fill({ status: 'completed' }, firstKey, { ...admin, memberId }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(env.checklist().summary().counts.unfilled).toBe(2);
    },
  );
  it('revalidates assignment and current role rather than trusting command claims', async () => {
    env.replaceOccurrence(
      occurrence()
        .configure({
          ...occurrence().toRecord().configuration,
          participationMode: 'assigned',
        })
        .assignTeam(['member']),
    );
    await env.setup();
    env.replaceOccurrence(occurrence().assignTeam([]));
    await expect(fill()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({ id: 'manager', role: 'member' });
    await expect(
      fill({ status: 'completed' }, firstKey, manager),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('does not store executor fields supplied as unknown extra input properties', async () => {
    await env.setup();
    await fill({
      status: 'completed',
      performedBy: 'member',
      actorId: 'member',
    } as VerificationInput);
    const technical = JSON.stringify({
      checklist: env.checklist().toRecord(),
      receipts: [...env.receipts.values()],
      events: env.checklistEvents,
    });
    expect(technical).not.toMatch(/performedBy|actorId|memberId|checkIn/);
  });
  it.each(['', ' ', '\n'])(
    'requires a problem description %j and creates no partial issue',
    async (description) => {
      await env.setup();
      await expect(
        fill({ status: 'problem_found', description }),
      ).rejects.toMatchObject({ code: 'INVALID_TEXT' });
      expect(env.problems.size).toBe(0);
      expect(version()).toBe(1);
    },
  );
  it('records a linked issue and optional photo reference without storing photographs', async () => {
    await env.setup();
    const id = await problem();
    const [issue] = await env.service.listProblems(member, 'occurrence');
    expect(issue).toMatchObject({
      id,
      occurrenceId: 'occurrence',
      verificationKey: firstKey,
      status: 'pending',
      photoReference: 'future-photo',
    });
    expect(env.checklist().verification(firstKey).problemIds).toEqual([id]);
    expect(env.checklist().verification(secondKey).result.status).toBe(
      'unfilled',
    );
  });
  it('deduplicates a repeated command with its old expected version but preserves distinct real reports', async () => {
    await env.setup();
    const command = env.command(),
      input = {
        status: 'problem_found',
        description: 'Falha sintética',
      } as const;
    const first = await env.service.recordResult(
      member,
      'occurrence',
      firstKey,
      input,
      1,
      1,
      command,
    );
    const retry = await env.service.recordResult(
      member,
      'occurrence',
      firstKey,
      input,
      1,
      1,
      command,
    );
    expect(retry).toEqual(first);
    expect(env.problems.size).toBe(1);
    await fill(input);
    expect(env.problems.size).toBe(2);
    expect(env.checklist().verification(firstKey).problemIds).toHaveLength(2);
  });
  it('reuses a problem only via an explicit matching link without rewriting it', async () => {
    await env.setup();
    const id = await problem(),
      before = [...env.problems.values()][0];
    await fill({ status: 'completed' });
    await fill({
      status: 'problem_found',
      description: 'Falha sintética',
      photoReference: 'future-photo',
      existingProblemId: id,
    });
    expect(env.problems.size).toBe(1);
    expect([...env.problems.values()][0]).toBe(before);
    await expect(
      fill({
        status: 'problem_found',
        description: 'Texto diferente',
        existingProblemId: id,
      }),
    ).rejects.toMatchObject({ code: 'PROBLEM_DETAILS_MISMATCH' });
    await expect(
      fill(
        {
          status: 'problem_found',
          description: 'Falha sintética',
          photoReference: 'future-photo',
          existingProblemId: id,
        },
        secondKey,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PROBLEM_LINK' });
  });
  it('keeps actual issues pending when a checklist result changes away from problem-found', async () => {
    await env.setup();
    const id = await problem();
    await fill({ status: 'not_applicable' });
    expect(
      (await env.service.listProblems(member, 'occurrence'))[0],
    ).toMatchObject({ id, status: 'pending' });
    expect(env.checklist().verification(firstKey).problemIds).toEqual([id]);
  });
  it('resolves a problem only through an authorized independent operation and preserves technical history', async () => {
    await env.setup();
    const id = await problem();
    await expect(
      env.service.resolveProblem(member, id, 1, env.command()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    env.seedMember({ id: 'other', role: 'maintenance_manager' });
    await expect(
      env.service.resolveProblem(
        { ...admin, memberId: 'other' },
        id,
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await env.service.resolveProblem(manager, id, 1, env.command());
    expect(await env.service.listProblems(member, 'occurrence')).toEqual([]);
    expect(
      (await env.service.listProblems(member, 'occurrence', false))[0],
    ).toMatchObject({ id, status: 'resolved' });
    expect(env.checklist().verification(firstKey).result.status).toBe(
      'problem_found',
    );
  });
  it('rejects old checklist/occurrence versions and reused command identifiers with different payload', async () => {
    await env.setup();
    const command = env.command();
    await env.service.recordResult(
      member,
      'occurrence',
      firstKey,
      { status: 'completed' },
      1,
      1,
      command,
    );
    await expect(
      env.service.recordResult(
        member,
        'occurrence',
        firstKey,
        { status: 'not_applicable' },
        1,
        1,
        command,
      ),
    ).rejects.toMatchObject({ code: 'COMMAND_ID_REUSED' });
    await expect(
      env.service.recordResult(
        member,
        'occurrence',
        secondKey,
        { status: 'completed' },
        1,
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    env.replaceOccurrence(
      occurrence().reschedule(
        { ...occurrence().toRecord().schedule, time: '10:00' },
        'preserve',
      ),
    );
    await expect(
      env.service.recordResult(
        member,
        'occurrence',
        secondKey,
        { status: 'completed' },
        version(),
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
  it('allows only one concurrent stale version write and rolls back issue insertion after a failed CAS', async () => {
    await env.setup();
    const results = await Promise.allSettled([
      env.service.recordResult(
        member,
        'occurrence',
        firstKey,
        { status: 'completed' },
        1,
        1,
        env.command(),
      ),
      env.service.recordResult(
        manager,
        'occurrence',
        firstKey,
        { status: 'not_applicable' },
        1,
        1,
        env.command(),
      ),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' },
    });
    env.rejectChecklistSave = true;
    const before = env.checklist();
    await expect(problem()).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(env.problems.size).toBe(0);
    expect(env.checklist()).toBe(before);
  });
  it('rolls back result, issue, receipt and technical event if receipt persistence fails', async () => {
    await env.setup();
    const checklist = env.checklist(),
      events = [...env.checklistEvents],
      receipts = new Map(env.receipts);
    env.failReceipts = true;
    await expect(problem()).rejects.toThrow('Receipt storage failed');
    expect(env.checklist()).toBe(checklist);
    expect(env.problems.size).toBe(0);
    expect(env.checklistEvents).toEqual(events);
    expect(env.receipts).toEqual(receipts);
  });
});

describe('technical completion and administrative corrections', () => {
  it('previews missing checks and concludes with missing items and pending issues', async () => {
    await env.setup();
    const id = await problem();
    const preview = await env.service.previewCompletion(manager, 'occurrence');
    expect(preview).toMatchObject({
      openProblems: 1,
      summary: {
        counts: { unfilled: 1, problem_found: 1 },
        unfilledKeys: [secondKey],
      },
    });
    const result = await complete();
    expect(result.result.summary).toEqual(preview.summary);
    expect(occurrence().toRecord().status).toBe('completed');
    expect(env.checklist().toRecord().completion?.completedAt).toBe(env.now);
    expect((await env.service.listProblems(member, 'occurrence'))[0]?.id).toBe(
      id,
    );
    expect(env.completionWrites).toBe(1);
    expect([...env.annual.values()][0]).toMatchObject({
      status: 'completed',
      completedAt: env.now,
    });
  });
  it.each(['admin', 'manager'])(
    'allows completion by %s with all checks unfilled',
    async (memberId) => {
      await env.setup();
      await env.service.complete(
        { ...admin, memberId },
        'occurrence',
        version(),
        1,
        env.command(),
      );
      expect(occurrence().toRecord().status).toBe('completed');
      expect(env.checklist().summary().counts.unfilled).toBe(2);
    },
  );
  it.each(['member', 'other', 'inactive', 'foreign'])(
    'denies completion by %s',
    async (memberId) => {
      await env.setup();
      await expect(
        env.service.complete(
          { ...admin, memberId },
          'occurrence',
          version(),
          1,
          env.command(),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(occurrence().toRecord().status).toBe('scheduled');
    },
  );
  it('treats an exact completion retry as idempotent and never counts a second completion', async () => {
    await env.setup();
    const command = env.command(),
      v = version();
    const first = await env.service.complete(
      manager,
      'occurrence',
      v,
      1,
      command,
    );
    const retry = await env.service.complete(
      manager,
      'occurrence',
      v,
      1,
      command,
    );
    expect(retry).toEqual(first);
    expect(env.completionWrites).toBe(1);
    await expect(complete()).rejects.toMatchObject({
      code: 'OCCURRENCE_COMPLETED',
    });
    expect(
      env.checklistEvents.filter((e) => e.kind === 'maintenance_completed'),
    ).toHaveLength(1);
  });
  it('discards every availability revision, invitation, individual event and job in the completion transaction', async () => {
    await env.setup();
    await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
    await env.availabilityService.respond(
      member,
      'occurrence',
      1,
      'yes',
      env.plan().toRecord().version,
    );
    await env.maintenanceService.reschedule(
      admin,
      'occurrence',
      { ...occurrence().toRecord().schedule, date: '2026-12-05' },
      'reconfirm',
      1,
      { kind: 'keep', expectedVersion: env.plan().toRecord().version },
    );
    expect(env.plans.size).toBe(2);
    const oldInvitation = env.events.find(
      (e) => e.kind === 'invitation_needed',
    );
    if (!oldInvitation) throw new Error('Missing invitation');
    await complete();
    expect(env.plans.size).toBe(0);
    expect(env.events).toEqual([]);
    expect(env.jobs).toEqual([]);
    expect(env.maintenanceEvents).toEqual([]);
    expect(env.disposals.size).toBe(1);
    expect([...env.disposals.values()][0]?.terminal).toBe('completed');
    expect(
      await env.availabilityService.invitationIsCurrent(oldInvitation),
    ).toBe(false);
    await expect(
      env.availabilityService.configure(
        admin,
        'occurrence',
        deadline,
        occurrence().version,
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
    await expect(
      env.availabilityService.respond(member, 'occurrence', 2, 'yes', 1),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
  });
  it('does not recreate availability or invent a completion receipt when an adapter loses its terminal marker', async () => {
    await env.setup();
    await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
    await complete();
    await env.availabilityService.refresh('congregation', 'occurrence', 1);
    expect(env.plans.size).toBe(0);
    // Deliberately corrupt the adapter to exercise the integration guard.
    env.disposals.clear();
    await expect(
      env.availabilityService.refresh('congregation', 'occurrence', 1),
    ).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_REQUIRED' });
    expect(env.disposals.size).toBe(0);
    expect(env.plans.size).toBe(0);
    expect(env.completionWrites).toBe(1);
  });
  it('blocks ordinary checklist edits, occasional additions, cancellation, rescheduling and team edits after completion', async () => {
    await env.setup();
    await complete();
    await expect(fill()).rejects.toMatchObject({
      code: 'OCCURRENCE_COMPLETED',
    });
    await expect(
      env.service.addOccasional(
        manager,
        'occurrence',
        { ...definitions[0], taskId: 'extra' },
        version(),
        occurrence().version,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
    await expect(
      env.maintenanceService.cancel(admin, 'occurrence', occurrence().version),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
    await expect(
      env.maintenanceService.reschedule(
        admin,
        'occurrence',
        occurrence().toRecord().schedule,
        'preserve',
        occurrence().version,
        { kind: 'replace', deadline, expectedVersion: null },
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
    await expect(
      env.maintenanceService.assignTeam(
        admin,
        'occurrence',
        [],
        occurrence().version,
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_COMPLETED' });
    expect(occurrence().planningWarning()).toBeNull();
    const active = env.members.get('member');
    if (!active) throw new Error('Missing member');
    expect(occurrence().canParticipate(active)).toBe(false);
  });
  it('supports admin correction with preserved previous data without reopening or another annual conclusion', async () => {
    await env.setup();
    await complete();
    const original = env.checklist().toRecord().completion,
      annual = [...env.annual.values()][0],
      occ = occurrence();
    await env.service.correct(
      admin,
      'occurrence',
      firstKey,
      { status: 'completed' },
      'Correção técnica sintética',
      version(),
      occ.version,
      env.command(),
    );
    const record = env.checklist().toRecord();
    expect(record.completion).toEqual(original);
    expect(record.corrections).toHaveLength(1);
    expect(record.corrections[0]).toMatchObject({
      before: { result: { status: 'unfilled' } },
      after: { result: { status: 'completed' } },
      recordedAt: env.now,
      nature: 'Correção técnica sintética',
    });
    expect(occurrence()).toBe(occ);
    expect([...env.annual.values()][0]).toBe(annual);
    expect(env.completionWrites).toBe(1);
    expect(JSON.stringify(record)).not.toMatch(/actorId|memberId|performedBy/);
  });
  it('denies administrative correction by a manager and denies correction before completion or after cancellation', async () => {
    await env.setup();
    await expect(
      env.service.correct(
        admin,
        'occurrence',
        firstKey,
        { status: 'completed' },
        'Correção',
        version(),
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'CORRECTION_REQUIRES_COMPLETION' });
    await complete();
    await expect(
      env.service.correct(
        manager,
        'occurrence',
        firstKey,
        { status: 'completed' },
        'Correção',
        version(),
        occurrence().version,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('preserves a real pending issue when admin corrects a completed checklist and can resolve it independently later', async () => {
    await env.setup();
    const id = await problem();
    await complete();
    await env.service.correct(
      admin,
      'occurrence',
      firstKey,
      { status: 'completed' },
      'Correção de resultado',
      version(),
      occurrence().version,
      env.command(),
    );
    expect(
      (await env.service.listProblems(member, 'occurrence'))[0],
    ).toMatchObject({ id, status: 'pending' });
    await env.service.resolveProblem(manager, id, 1, env.command());
    expect(await env.service.listProblems(member, 'occurrence')).toEqual([]);
    expect(
      (await env.service.listProblems(member, 'occurrence', false))[0]?.status,
    ).toBe('resolved');
    expect(env.completionWrites).toBe(1);
  });
  it.each([
    'annual',
    'retention',
    'event',
    'receipt',
    'occurrence-cas',
  ] as const)(
    'rolls back every completion effect on %s failure',
    async (failure) => {
      await env.setup();
      await env.availabilityService.configure(admin, 'occurrence', deadline, 1);
      const original = occurrence(),
        checklist = env.checklist(),
        annual = [...env.annual.values()][0],
        events = [...env.checklistEvents],
        jobs = [...env.jobs],
        availabilityEvents = [...env.events],
        receipts = new Map(env.receipts);
      env.failAnnual = failure === 'annual';
      env.failDisposal = failure === 'retention';
      env.failChecklistEvents = failure === 'event';
      env.failReceipts = failure === 'receipt';
      env.rejectOccurrenceSave = failure === 'occurrence-cas';
      await expect(complete()).rejects.toThrow();
      expect(occurrence()).toBe(original);
      expect(env.checklist()).toBe(checklist);
      expect([...env.annual.values()][0]).toBe(annual);
      expect(env.completionWrites).toBe(0);
      expect(env.plans.size).toBe(1);
      expect(env.disposals.size).toBe(0);
      expect(env.jobs).toEqual(jobs);
      expect(env.events).toEqual(availabilityEvents);
      expect(env.checklistEvents).toEqual(events);
      expect(env.receipts).toEqual(receipts);
    },
  );
  it('accepts only one concurrent completion with different command IDs', async () => {
    await env.setup();
    const v = version(),
      results = await Promise.allSettled([
        env.service.complete(admin, 'occurrence', v, 1, env.command()),
        env.service.complete(manager, 'occurrence', v, 1, env.command()),
      ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'OCCURRENCE_COMPLETED' },
    });
    expect(env.completionWrites).toBe(1);
  });
  it('protects cancelled occurrences from all late mutations', async () => {
    await env.setup();
    await env.maintenanceService.cancel(admin, 'occurrence', 1);
    await expect(fill()).rejects.toMatchObject({
      code: 'OCCURRENCE_CANCELLED',
    });
    await expect(complete()).rejects.toMatchObject({
      code: 'OCCURRENCE_CANCELLED',
    });
    await expect(
      env.service.correct(
        admin,
        'occurrence',
        firstKey,
        { status: 'completed' },
        'Correção',
        version(),
        occurrence().version,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'OCCURRENCE_CANCELLED' });
    expect(await env.service.listProblems(admin, 'occurrence')).toEqual([]);
  });
  it('does not recreate or replace a completed recurrence cycle during later generation', async () => {
    await env.service.saveTemplate(
      admin,
      'fortnightly',
      definitions,
      null,
      env.command(),
    );
    const rule = await env.maintenanceService.approveRule(admin, {
      category: 'fortnightly',
      startsOn: '2026-11-01',
      endsOn: null,
      time: '09:00',
      timeZone: 'UTC',
      pattern: { kind: 'weekends', day: 'saturday' },
      defaults: occurrence().toRecord().configuration,
    });
    const range = { from: '2026-11-07', to: '2026-11-07' },
      [generated] = await env.maintenanceService.generate(
        admin,
        rule.id,
        range,
        1,
      );
    if (!generated) throw new Error('Missing generated occurrence');
    await env.service.createChecklist(manager, generated.id, 1, env.command());
    await env.service.complete(
      manager,
      generated.id,
      env.checklist(generated.id).toRecord().version,
      1,
      env.command(),
    );
    const repeat = await env.maintenanceService.generate(
      admin,
      rule.id,
      range,
      1,
    );
    expect(repeat).toHaveLength(1);
    expect(repeat[0]).toMatchObject({
      id: generated.id,
      status: 'completed',
      version: 2,
    });
    expect(env.completionWrites).toBe(1);
  });
  it('keeps templates, checklists, issues, receipts and completion isolated by congregation', async () => {
    await env.setup();
    env.seedMember({
      id: 'foreign-admin',
      congregationId: 'foreign',
      role: 'administrator',
    });
    const foreign = { congregationId: 'foreign', memberId: 'foreign-admin' };
    await expect(
      env.service.getChecklist(foreign, 'occurrence'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      env.service.complete(foreign, 'occurrence', version(), 1, env.command()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    env.seedOccurrence({
      id: 'foreign-occurrence',
      congregationId: 'foreign',
      configuration: {
        participationMode: 'open',
        quantities: { minimum: null, desired: null },
        responsibleMemberIds: [],
      },
    });
    await env.service.saveTemplate(
      foreign,
      'fortnightly',
      definitions,
      null,
      env.command(),
    );
    await env.service.createChecklist(
      foreign,
      'foreign-occurrence',
      1,
      env.command(),
    );
    await env.service.recordResult(
      foreign,
      'foreign-occurrence',
      firstKey,
      { status: 'problem_found', description: 'Falha sintética estrangeira' },
      1,
      1,
      env.command(),
    );
    const foreignProblem = [...env.problems.values()].find(
      (p) => p.toRecord().congregationId === 'foreign',
    );
    if (!foreignProblem) throw new Error('Missing problem');
    await expect(
      env.service.resolveProblem(
        admin,
        foreignProblem.toRecord().id,
        1,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(env.checklist().summary().counts.unfilled).toBe(2);
    expect(await env.service.listProblems(admin, 'occurrence')).toEqual([]);
    expect(env.templates.size).toBe(2);
    expect(env.checklists.size).toBe(2);
  });
  it('repository CAS refuses a second direct write from the same version without an application precheck', async () => {
    await env.setup();
    const original = env.checklist(),
      first = original.recordResult(firstKey, {
        status: 'completed',
        description: null,
        photoReference: null,
        problemId: null,
      }),
      second = original.recordResult(firstKey, {
        status: 'not_applicable',
        description: null,
        photoReference: null,
        problemId: null,
      });
    expect(
      await env.runChecklist(admin.congregationId, (tx) =>
        tx.checklists.saveIfVersion(first, 1),
      ),
    ).toBe(true);
    expect(
      await env.runChecklist(admin.congregationId, (tx) =>
        tx.checklists.saveIfVersion(second, 1),
      ),
    ).toBe(false);
    expect(env.checklist()).toBe(first);
    expect(() =>
      MaintenanceChecklist.restore({
        ...original.toRecord(),
        templateVersion: 0,
      }),
    ).toThrow('INVALID_VERSION');
  });
  it('rejects stale administrative correction and rolls back any newly reported problem', async () => {
    await env.setup();
    await complete();
    const old = version();
    await env.service.correct(
      admin,
      'occurrence',
      firstKey,
      { status: 'completed' },
      'Correção técnica',
      old,
      occurrence().version,
      env.command(),
    );
    await expect(
      env.service.correct(
        admin,
        'occurrence',
        secondKey,
        { status: 'not_applicable' },
        'Correção antiga',
        old,
        occurrence().version,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const before = env.checklist(),
      annual = [...env.annual.values()][0];
    env.rejectChecklistSave = true;
    await expect(
      env.service.correct(
        admin,
        'occurrence',
        firstKey,
        { status: 'problem_found', description: 'Falha sintética adicional' },
        'Correção com problema',
        version(),
        occurrence().version,
        env.command(),
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(env.checklist()).toBe(before);
    expect(env.problems.size).toBe(0);
    expect([...env.annual.values()][0]).toBe(annual);
  });
  it('preserves an original issue and its completed snapshot when a correction adds another issue', async () => {
    await env.setup();
    const originalId = await problem();
    await complete();
    const completed = env.checklist().toRecord().completion;
    await env.service.correct(
      admin,
      'occurrence',
      firstKey,
      {
        status: 'problem_found',
        description: 'Outro relato técnico sintético',
      },
      'Correção técnica de descrição',
      version(),
      occurrence().version,
      env.command(),
    );
    const all = await env.service.listProblems(admin, 'occurrence');
    expect(all).toHaveLength(2);
    expect(
      all.some(
        (p) => p.id === originalId && p.description === 'Falha sintética',
      ),
    ).toBe(true);
    expect(env.checklist().toRecord().completion).toEqual(completed);
    expect(env.checklist().verification(firstKey).problemIds).toHaveLength(2);
    expect(env.completionWrites).toBe(1);
  });
  it('rejects stale problem resolution and never resolves or reopens it through a repeated checklist result', async () => {
    await env.setup();
    const id = await problem(),
      command = env.command();
    const result = await env.service.resolveProblem(admin, id, 1, command);
    expect(await env.service.resolveProblem(admin, id, 1, command)).toEqual(
      result,
    );
    await expect(
      env.service.resolveProblem(manager, id, 1, env.command()),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(
      (await env.service.listProblems(admin, 'occurrence', false))[0]?.status,
    ).toBe('resolved');
  });
});
