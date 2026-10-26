import { describe, expect, it } from 'vitest';
import {
  AvailabilityPlan,
  instant,
} from '../../src/domain/availability/AvailabilityPlan';
import type { AvailabilityResponse } from '../../src/domain/availability/AvailabilityPlan';
import { deadline, later } from './AvailabilityTestEnvironment';
const now = '2026-10-26T12:00:00.000Z';
function plan() {
  return AvailabilityPlan.create({
    congregationId: 'congregation',
    occurrenceId: 'occurrence',
    revision: 1,
    deadline,
    audience: ['a', 'b', 'c', 'd'],
  });
}

describe('availability domain', () => {
  it('represents silence as unanswered, never a negative response', () => {
    expect(plan().totals(['a', 'b'])).toEqual({
      yes: 0,
      no: 0,
      maybe: 0,
      unanswered: 2,
    });
  });
  it.each(['yes', 'no', 'maybe'] as const)(
    'records and replaces the latest response %s',
    (value) => {
      const original = plan(),
        first = original.respond('a', 'maybe', now),
        next = first.respond('a', value, now);
      expect(next.response('a')).toBe(value);
      expect(next.toRecord().answers).toHaveLength(1);
      expect(original.response('a')).toBe('unanswered');
      expect(Object.isFrozen(next.toRecord().answers)).toBe(true);
    },
  );
  it('counts only the current eligible audience', () => {
    const current = plan()
      .respond('a', 'yes', now)
      .respond('b', 'no', now)
      .respond('c', 'maybe', now);
    expect(current.totals(['a', 'b', 'c', 'd'])).toEqual({
      yes: 1,
      no: 1,
      maybe: 1,
      unanswered: 1,
    });
    expect(current.totals(['b', 'd'])).toEqual({
      yes: 0,
      no: 1,
      maybe: 0,
      unanswered: 1,
    });
  });
  it('expires at the exact deadline without needing an application read', () => {
    expect(plan().isOpen('2026-11-01T11:59:59.999Z')).toBe(true);
    expect(plan().isOpen(deadline)).toBe(false);
    expect(plan().expire(deadline).toRecord().closed).toBe(true);
  });
  it.each(['yes', 'no', 'maybe'] as const)(
    'rejects a first late response %s',
    (value) => {
      expect(() => plan().respond('a', value, deadline)).toThrow(
        'WINDOW_CLOSED',
      );
    },
  );
  it.each(['no', 'maybe'] as const)(
    'rejects changing %s to yes after closure',
    (value) => {
      expect(() =>
        plan().respond('a', value, now).respond('a', 'yes', deadline),
      ).toThrow('WINDOW_CLOSED');
    },
  );
  it('permits only yes to no after manual or automatic closure', () => {
    const confirmed = plan().respond('a', 'yes', now);
    expect(confirmed.respond('a', 'no', deadline).response('a')).toBe('no');
    expect(confirmed.close().respond('a', 'no', now).response('a')).toBe('no');
    expect(() => confirmed.respond('a', 'maybe', deadline)).toThrow(
      'WINDOW_CLOSED',
    );
  });
  it('reopens with a new generation and future deadline preserving current responses', () => {
    const current = plan()
      .respond('a', 'yes', now)
      .expire(deadline)
      .reopen(later, deadline);
    expect(current.isOpen(deadline)).toBe(true);
    expect(current.response('a')).toBe('yes');
    expect(current.toRecord().windowGeneration).toBe(2);
    expect(() => plan().reopen(later, now)).toThrow('WINDOW_ALREADY_OPEN');
    expect(() => plan().expire(deadline).reopen(deadline, deadline)).toThrow(
      'INVALID_DEADLINE',
    );
  });
  it('invalidates removed audience responses rather than restoring them on reinclusion', () => {
    const current = plan()
      .respond('a', 'yes', now)
      .reconcile(['b'])
      .reconcile(['a', 'b']);
    expect(current.response('a')).toBe('unanswered');
  });
  it('normalizes audience and preserves true no-ops', () => {
    const current = plan();
    expect(current.reconcile(['d', 'c', 'b', 'a'])).toBe(current);
    const response = current.respond('a', 'yes', now);
    expect(response.respond('a', 'yes', now)).toBe(response);
    expect(current.expire(now)).toBe(current);
  });
  it.each([
    '2026-02-30T12:00:00.000Z',
    '2026-11-01',
    'not-a-date',
    '2026-11-01T12:00:00+00:00',
  ])('rejects noncanonical or invalid instant %s', (date) => {
    expect(() => instant(date)).toThrow('INVALID_INSTANT');
  });
  it('rejects invalid answers, duplicates, outsiders and version overflow', () => {
    const current = plan();
    expect(() => current.respond('outsider', 'yes', now)).toThrow('FORBIDDEN');
    expect(() =>
      current.respond('a', 'unanswered' as AvailabilityResponse, now),
    ).toThrow('INVALID_RESPONSE');
    expect(() =>
      AvailabilityPlan.restore({
        ...current.toRecord(),
        answers: [
          { memberId: 'a', value: 'yes' },
          { memberId: 'a', value: 'no' },
        ],
      }),
    ).toThrow('INVALID_RESPONSE');
    expect(() =>
      AvailabilityPlan.restore({
        ...current.toRecord(),
        version: Number.MAX_SAFE_INTEGER,
      }).close(),
    ).toThrow('INVALID_VERSION');
  });
});
