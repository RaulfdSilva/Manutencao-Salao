import {
  assertIdentifier,
  assertVersion,
  freezeIds,
} from '../maintenance/MaintenanceTypes';
import { AvailabilityError } from './AvailabilityError';

export type AvailabilityResponse = 'yes' | 'no' | 'maybe';
export type AvailabilityView = AvailabilityResponse | 'unanswered';
export interface AvailabilityAnswer {
  readonly memberId: string;
  readonly value: AvailabilityResponse;
}
export interface AvailabilityInvitation {
  readonly memberId: string;
  readonly generation: number;
}
export interface AvailabilityRecord {
  readonly congregationId: string;
  readonly occurrenceId: string;
  readonly revision: number;
  readonly version: number;
  readonly deadline: string;
  readonly windowGeneration: number;
  readonly closed: boolean;
  readonly audience: readonly string[];
  readonly eligibilityGeneration: number;
  readonly invitations: readonly AvailabilityInvitation[];
  readonly answers: readonly AvailabilityAnswer[];
}
export function instant(value: string): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  )
    throw new AvailabilityError('INVALID_INSTANT');
  const result = Date.parse(value);
  if (!Number.isFinite(result) || new Date(result).toISOString() !== value)
    throw new AvailabilityError('INVALID_INSTANT');
  return result;
}
export class AvailabilityPlan {
  private readonly record: AvailabilityRecord;
  private constructor(record: AvailabilityRecord) {
    [record.congregationId, record.occurrenceId].forEach(assertIdentifier);
    [
      record.revision,
      record.version,
      record.windowGeneration,
      record.eligibilityGeneration,
    ].forEach(assertVersion);
    instant(record.deadline);
    if (typeof record.closed !== 'boolean')
      throw new AvailabilityError('INVALID_RESPONSE');
    const audience = freezeIds(record.audience);
    const invitations = record.invitations.map((invitation) => {
      assertVersion(invitation.generation);
      if (
        !audience.includes(invitation.memberId) ||
        invitation.generation > record.eligibilityGeneration
      )
        throw new AvailabilityError('INVALID_RESPONSE');
      return Object.freeze({
        memberId: invitation.memberId,
        generation: invitation.generation,
      });
    });
    if (
      invitations.length !== audience.length ||
      new Set(invitations.map((i) => i.memberId)).size !== audience.length
    )
      throw new AvailabilityError('INVALID_RESPONSE');
    const seen = new Set<string>();
    const answers = record.answers.map((answer) => {
      if (
        !['yes', 'no', 'maybe'].includes(answer.value) ||
        !audience.includes(answer.memberId) ||
        seen.has(answer.memberId)
      )
        throw new AvailabilityError('INVALID_RESPONSE');
      seen.add(answer.memberId);
      return Object.freeze({ memberId: answer.memberId, value: answer.value });
    });
    this.record = Object.freeze({
      congregationId: record.congregationId,
      occurrenceId: record.occurrenceId,
      revision: record.revision,
      version: record.version,
      deadline: record.deadline,
      windowGeneration: record.windowGeneration,
      closed: record.closed,
      eligibilityGeneration: record.eligibilityGeneration,
      invitations: Object.freeze(
        invitations.sort((a, b) => a.memberId.localeCompare(b.memberId)),
      ),
      audience,
      answers: Object.freeze(
        answers.sort((a, b) => a.memberId.localeCompare(b.memberId)),
      ),
    });
    Object.freeze(this);
  }
  static create(
    input: Pick<
      AvailabilityRecord,
      'congregationId' | 'occurrenceId' | 'revision' | 'deadline' | 'audience'
    >,
  ): AvailabilityPlan {
    return new AvailabilityPlan({
      ...input,
      version: 1,
      windowGeneration: 1,
      closed: false,
      answers: [],
      eligibilityGeneration: 1,
      invitations: input.audience.map((memberId) => ({
        memberId,
        generation: 1,
      })),
    });
  }
  static restore(record: AvailabilityRecord): AvailabilityPlan {
    return new AvailabilityPlan(record);
  }
  toRecord(): AvailabilityRecord {
    return this.record;
  }
  isOpen(now: string): boolean {
    return !this.record.closed && instant(now) < instant(this.record.deadline);
  }
  response(memberId: string): AvailabilityView {
    return (
      this.record.answers.find((a) => a.memberId === memberId)?.value ??
      'unanswered'
    );
  }
  expire(now: string): AvailabilityPlan {
    return !this.record.closed && instant(now) >= instant(this.record.deadline)
      ? this.evolve({ closed: true })
      : this;
  }
  close(): AvailabilityPlan {
    return this.record.closed ? this : this.evolve({ closed: true });
  }
  reopen(deadline: string, now: string): AvailabilityPlan {
    if (this.isOpen(now)) throw new AvailabilityError('WINDOW_ALREADY_OPEN');
    if (instant(deadline) <= instant(now))
      throw new AvailabilityError('INVALID_DEADLINE');
    return this.evolve({
      deadline,
      closed: false,
      windowGeneration: this.record.windowGeneration + 1,
    });
  }
  reconcile(ids: readonly string[]): AvailabilityPlan {
    const audience = freezeIds(ids);
    if (JSON.stringify(audience) === JSON.stringify(this.record.audience))
      return this;
    return this.evolve({
      audience,
      eligibilityGeneration: this.record.eligibilityGeneration + 1,
      invitations: audience.map(
        (memberId) =>
          this.record.invitations.find((i) => i.memberId === memberId) ?? {
            memberId,
            generation: this.record.eligibilityGeneration + 1,
          },
      ),
      answers: this.record.answers.filter((a) => audience.includes(a.memberId)),
    });
  }
  respond(
    memberId: string,
    value: AvailabilityResponse,
    now: string,
  ): AvailabilityPlan {
    if (!this.record.audience.includes(memberId))
      throw new AvailabilityError('FORBIDDEN');
    if (!['yes', 'no', 'maybe'].includes(value))
      throw new AvailabilityError('INVALID_RESPONSE');
    const previous = this.response(memberId);
    if (!this.isOpen(now) && !(previous === 'yes' && value === 'no')) {
      if (previous === value) return this;
      throw new AvailabilityError('WINDOW_CLOSED');
    }
    if (previous === value) return this;
    return this.evolve({
      answers: [
        ...this.record.answers.filter((a) => a.memberId !== memberId),
        { memberId, value },
      ],
    });
  }
  totals(
    eligibleIds: readonly string[],
  ): Readonly<Record<AvailabilityView, number>> {
    const totals = { yes: 0, no: 0, maybe: 0, unanswered: 0 };
    for (const id of freezeIds(eligibleIds)) totals[this.response(id)]++;
    return Object.freeze(totals);
  }
  private evolve(
    changes: Partial<
      Pick<
        AvailabilityRecord,
        | 'deadline'
        | 'closed'
        | 'windowGeneration'
        | 'audience'
        | 'answers'
        | 'eligibilityGeneration'
        | 'invitations'
      >
    >,
  ): AvailabilityPlan {
    return new AvailabilityPlan({
      ...this.record,
      ...changes,
      version: this.record.version + 1,
    });
  }
}
