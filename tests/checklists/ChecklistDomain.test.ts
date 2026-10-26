import { describe, expect, it } from 'vitest';
import { ChecklistTemplate } from '../../src/domain/checklists/ChecklistTemplate';
import { MaintenanceChecklist } from '../../src/domain/checklists/MaintenanceChecklist';
import { TechnicalProblem } from '../../src/domain/checklists/TechnicalProblem';
import {
  normalizeInput,
  verificationKey,
} from '../../src/domain/checklists/ChecklistTypes';
import type {
  VerificationInput,
  VerificationResult,
} from '../../src/domain/checklists/ChecklistTypes';
import { definitions, firstKey, secondKey } from './ChecklistTestEnvironment';
const now = '2026-10-26T12:00:00.000Z';
const done: VerificationResult = {
  status: 'completed',
  description: null,
  photoReference: null,
  problemId: null,
};
const failure: VerificationResult = {
  status: 'problem_found',
  description: 'Falha técnica sintética',
  photoReference: 'future-photo',
  problemId: 'problem',
};
function template() {
  return ChecklistTemplate.create({
    congregationId: 'congregation',
    category: 'fortnightly',
    definitions,
  });
}
function checklist() {
  return MaintenanceChecklist.create('occurrence', template());
}
function problem() {
  return TechnicalProblem.create({
    id: 'problem',
    congregationId: 'congregation',
    occurrenceId: 'occurrence',
    verificationKey: firstKey,
    description: 'Falha técnica sintética',
    photoReference: null,
    recordedAt: now,
  });
}

describe('checklist domain', () => {
  it('keeps task/equipment combinations independent without individual inventory', () => {
    const original = checklist(),
      changed = original.recordResult(firstKey, done);
    expect(changed.verification(firstKey).result.status).toBe('completed');
    expect(changed.verification(secondKey).result.status).toBe('unfilled');
    expect(
      changed.toRecord().verifications.map((v) => v.definition.taskId),
    ).toEqual(['synthetic-task', 'synthetic-task']);
    expect(verificationKey('a/b', 'c')).not.toBe(verificationKey('a', 'b/c'));
  });
  it('freezes the template snapshot and does not apply a later recurring model revision', () => {
    const original = template(),
      snapshot = MaintenanceChecklist.create('occurrence', original),
      revised = original.revise([
        ...definitions,
        { ...definitions[0], taskId: 'synthetic-new' },
      ]);
    expect(snapshot.toRecord().templateVersion).toBe(1);
    expect(snapshot.toRecord().verifications).toHaveLength(2);
    expect(
      MaintenanceChecklist.create('other', revised).toRecord().verifications,
    ).toHaveLength(3);
    expect(Object.isFrozen(snapshot.toRecord().verifications)).toBe(true);
  });
  it('rejects repeated task/equipment pairs but permits the same task in another category', () => {
    expect(() => template().revise([definitions[0], definitions[0]])).toThrow(
      'DUPLICATE_VERIFICATION',
    );
    expect(checklist().toRecord().verifications).toHaveLength(2);
  });
  it.each(['unfilled', 'completed', 'not_applicable'] as const)(
    'supports %s with no automatic completion on read',
    (status) => {
      const original = checklist(),
        result = {
          status,
          description: null,
          photoReference: null,
          problemId: null,
        };
      expect(original.verification(firstKey).result.status).toBe('unfilled');
      expect(
        original.recordResult(firstKey, result).verification(firstKey).result
          .status,
      ).toBe(status);
      expect(original.toRecord().version).toBe(1);
    },
  );
  it.each(['', ' ', '\n'])(
    'requires description for a problem (%j)',
    (description) => {
      expect(() =>
        normalizeInput({ status: 'problem_found', description }),
      ).toThrow('INVALID_TEXT');
    },
  );
  it('requires an explicit valid problem link and accepts only a future photo reference', () => {
    expect(() =>
      checklist().recordResult(firstKey, { ...failure, problemId: null }),
    ).toThrow('INVALID_RESULT');
    expect(() =>
      normalizeInput({
        status: 'problem_found',
        description: 'Falha',
        photoReference: '',
      }),
    ).toThrow('INVALID_IDENTIFIER');
    expect(
      checklist().recordResult(firstKey, failure).verification(firstKey)
        .problemIds,
    ).toEqual(['problem']);
    expect(() =>
      normalizeInput({ status: 'opened' } as unknown as VerificationInput),
    ).toThrow('INVALID_RESULT');
  });
  it('does not remove old problem links when correcting a result away from problem-found', () => {
    const result = checklist()
      .recordResult(firstKey, failure)
      .recordResult(firstKey, done);
    expect(result.verification(firstKey).result.status).toBe('completed');
    expect(result.verification(firstKey).problemIds).toEqual(['problem']);
  });
  it('adds an occasional task without changing the template', () => {
    const original = checklist(),
      added = original.addOccasional({
        ...definitions[0],
        taskId: 'synthetic-occasional',
      });
    expect(added.toRecord().verifications.at(-1)?.origin).toBe('occasional');
    expect(template().toRecord().definitions).toHaveLength(2);
    expect(() => original.addOccasional(definitions[0])).toThrow(
      'DUPLICATE_VERIFICATION',
    );
  });
  it('seals with unfilled entries and stores the original technical snapshot', () => {
    const sealed = checklist().seal(now);
    expect(sealed.summary().counts.unfilled).toBe(2);
    expect(sealed.toRecord().completion?.snapshot).toHaveLength(2);
    expect(() => sealed.recordResult(firstKey, done)).toThrow(
      'CHECKLIST_SEALED',
    );
    expect(() =>
      sealed.addOccasional({ ...definitions[0], taskId: 'extra' }),
    ).toThrow('CHECKLIST_SEALED');
    expect(() => sealed.seal(now)).toThrow('CHECKLIST_SEALED');
  });
  it('preserves before/after, nature, time and original completion during a correction', () => {
    const sealed = checklist().seal(now),
      corrected = sealed.correct(
        firstKey,
        done,
        'correction',
        'Correção técnica sintética',
        now,
      );
    expect(corrected.toRecord().corrections[0]).toMatchObject({
      id: 'correction',
      recordedAt: now,
      nature: 'Correção técnica sintética',
      before: { result: { status: 'unfilled' } },
      after: { result: { status: 'completed' } },
    });
    expect(corrected.toRecord().completion).toEqual(
      sealed.toRecord().completion,
    );
    expect(corrected.toRecord().completion?.snapshot[0]?.result.status).toBe(
      'unfilled',
    );
    expect(corrected.toRecord().version).toBe(sealed.toRecord().version + 1);
    expect(JSON.stringify(corrected.toRecord())).not.toMatch(
      /actorId|memberId|performedBy/,
    );
  });
  it('rejects correction without completion or nature', () => {
    expect(() =>
      checklist().correct(firstKey, done, 'correction', 'Correção', now),
    ).toThrow('CORRECTION_REQUIRES_COMPLETION');
    expect(() =>
      checklist().seal(now).correct(firstKey, done, 'correction', ' ', now),
    ).toThrow('INVALID_TEXT');
  });
  it('preserves no-ops and rejects missing checks, invalid source versions and overflow', () => {
    const initial = checklist();
    expect(
      initial.recordResult(firstKey, initial.verification(firstKey).result),
    ).toBe(initial);
    expect(() => initial.verification('missing')).toThrow(
      'VERIFICATION_NOT_FOUND',
    );
    expect(() =>
      MaintenanceChecklist.restore({ ...initial.toRecord(), version: 0 }),
    ).toThrow('INVALID_VERSION');
    expect(() =>
      MaintenanceChecklist.restore({
        ...initial.toRecord(),
        version: Number.MAX_SAFE_INTEGER,
      }).recordResult(firstKey, done),
    ).toThrow('INVALID_VERSION');
  });
  it('keeps an immutable technical problem after resolution with only two states', () => {
    const original = problem(),
      resolved = original.resolve(now);
    expect(original.toRecord().status).toBe('pending');
    expect(resolved.toRecord()).toMatchObject({
      status: 'resolved',
      version: 2,
      resolvedAt: now,
    });
    expect(resolved.resolve(now)).toBe(resolved);
    expect(Object.isFrozen(resolved.toRecord())).toBe(true);
    expect(() =>
      TechnicalProblem.restore({
        ...original.toRecord(),
        status: 'in_progress' as 'pending',
      }),
    ).toThrow('INVALID_PROBLEM_STATE');
  });
});
