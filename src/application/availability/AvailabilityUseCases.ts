import { assertDeadlineDecision } from '../maintenance/MaintenanceLifecycleContracts';
import type { AvailabilityReschedule } from '../maintenance/MaintenanceLifecycleContracts';
import type { Member } from '../../domain/members/Member';
import type { MaintenanceOccurrence } from '../../domain/maintenance/MaintenanceOccurrence';
import { assertVersion } from '../../domain/maintenance/MaintenanceTypes';
import { AvailabilityError } from '../../domain/availability/AvailabilityError';
import {
  AvailabilityPlan,
  instant,
} from '../../domain/availability/AvailabilityPlan';
import type { AvailabilityResponse } from '../../domain/availability/AvailabilityPlan';
import type { MemberActor } from '../members/MemberContracts';
import type {
  AvailabilityDeadline,
  AvailabilityDependencies,
  AvailabilityEventKind,
  AvailabilityEvent,
  AvailabilityPlanning,
  AvailabilityUnitOfWork,
} from './AvailabilityContracts';

function checkVersion(actual: number, expected: number): void {
  assertVersion(expected);
  if (actual !== expected) throw new AvailabilityError('VERSION_CONFLICT');
}
async function occurrenceIn(
  tx: AvailabilityUnitOfWork,
  scope: string,
  id: string,
): Promise<MaintenanceOccurrence> {
  const occurrence = await tx.occurrences.findById(scope, id);
  if (!occurrence || occurrence.congregationId !== scope)
    throw new AvailabilityError('OCCURRENCE_NOT_FOUND');
  return occurrence;
}
async function actorIn(
  tx: AvailabilityUnitOfWork,
  actor: MemberActor,
): Promise<Member> {
  const member = await tx.members.findById(
    actor.congregationId,
    actor.memberId,
  );
  if (
    !member ||
    member.status !== 'active' ||
    member.congregationId !== actor.congregationId
  )
    throw new AvailabilityError('FORBIDDEN');
  return member;
}
function scheduled(occurrence: MaintenanceOccurrence): void {
  if (occurrence.toRecord().status === 'cancelled')
    throw new AvailabilityError('OCCURRENCE_CANCELLED');
}
function currentRevision(
  occurrence: MaintenanceOccurrence,
  revision: number,
): void {
  assertVersion(revision);
  if (occurrence.toRecord().availabilityRevision !== revision)
    throw new AvailabilityError('REVISION_CONFLICT');
}
async function audienceIn(
  tx: AvailabilityUnitOfWork,
  occurrence: MaintenanceOccurrence,
): Promise<readonly string[]> {
  const record = occurrence.toRecord();
  if (record.status === 'cancelled') return [];
  return (await tx.members.list(record.congregationId))
    .filter(
      (m) =>
        m.congregationId === record.congregationId &&
        m.status === 'active' &&
        (record.configuration.participationMode === 'open' ||
          record.assignedMemberIds.includes(m.id)),
    )
    .map((m) => m.id)
    .sort();
}
async function planIn(
  tx: AvailabilityUnitOfWork,
  scope: string,
  id: string,
  revision: number,
): Promise<AvailabilityPlan> {
  if (await tx.retention.find(scope, id))
    throw new AvailabilityError('AVAILABILITY_DISPOSED');
  const plan = await tx.availability.find(scope, id, revision);
  if (!plan) throw new AvailabilityError('WINDOW_NOT_CONFIGURED');
  return plan;
}

/** Server orchestration contracts only. No authentication, scheduler or notification implementation. */
export class AvailabilityUseCases {
  constructor(private readonly dependencies: AvailabilityDependencies) {}

  /** Trusted outbox consumer check; not a client authorization endpoint. */
  invitationIsCurrent(event: AvailabilityEvent): Promise<boolean> {
    if (event.kind !== 'invitation_needed' || event.memberId === null)
      return Promise.resolve(false);
    return this.dependencies.transactions.run(
      event.congregationId,
      async (tx) => {
        const occurrence = await tx.occurrences.findById(
          event.congregationId,
          event.occurrenceId,
        );
        if (
          !occurrence ||
          occurrence.congregationId !== event.congregationId ||
          occurrence.toRecord().availabilityRevision !== event.revision ||
          !(await audienceIn(tx, occurrence)).includes(event.memberId ?? '')
        )
          return false;
        if (await tx.retention.find(event.congregationId, event.occurrenceId))
          return false;
        const plan = await tx.availability.find(
          event.congregationId,
          event.occurrenceId,
          event.revision,
        );
        return (
          !!plan &&
          plan.isOpen(this.now()) &&
          plan.toRecord().windowGeneration === event.windowGeneration &&
          plan
            .toRecord()
            .invitations.some(
              (i) =>
                i.memberId === event.memberId &&
                i.generation === event.invitationGeneration,
            ) &&
          plan.response(event.memberId ?? '') === 'unanswered'
        );
      },
    );
  }

  configure(
    actor: MemberActor,
    id: string,
    deadline: string,
    expectedOccurrenceVersion: number,
  ) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor);
        if (!member.isActiveAdministrator)
          throw new AvailabilityError('FORBIDDEN');
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        scheduled(occurrence);
        if (await tx.retention.find(actor.congregationId, id))
          throw new AvailabilityError('AVAILABILITY_DISPOSED');
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const revision = occurrence.toRecord().availabilityRevision;
        const existing = await tx.availability.find(
          actor.congregationId,
          id,
          revision,
        );
        if (existing) {
          if (existing.toRecord().deadline !== deadline)
            throw new AvailabilityError('VERSION_CONFLICT');
          return existing.toRecord();
        }
        const now = this.now();
        if (instant(deadline) <= instant(now))
          throw new AvailabilityError('INVALID_DEADLINE');
        const plan = AvailabilityPlan.create({
          congregationId: actor.congregationId,
          occurrenceId: id,
          revision,
          deadline,
          audience: await audienceIn(tx, occurrence),
        });
        if (!(await tx.availability.insertIfAbsent(plan)))
          throw new AvailabilityError('VERSION_CONFLICT');
        await this.emit(tx, plan, 'window_configured', now, actor.memberId);
        if (revision > 1)
          await this.emit(
            tx,
            plan,
            'reconfirmation_required',
            now,
            actor.memberId,
          );
        for (const memberId of plan.toRecord().audience)
          await this.emit(
            tx,
            plan,
            'invitation_needed',
            now,
            actor.memberId,
            memberId,
          );
        await this.schedule(tx, plan);
        return plan.toRecord();
      },
    );
  }

  respond(
    actor: MemberActor,
    id: string,
    revision: number,
    value: AvailabilityResponse,
    expectedVersion: number,
  ) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        scheduled(occurrence);
        currentRevision(occurrence, revision);
        const audience = await audienceIn(tx, occurrence);
        if (!audience.includes(actor.memberId))
          throw new AvailabilityError('FORBIDDEN');
        const before = await planIn(tx, actor.congregationId, id, revision);
        checkVersion(before.toRecord().version, expectedVersion);
        const now = this.now();
        const reconciled = before.reconcile(audience).expire(now);
        const previous = reconciled.response(actor.memberId);
        const changed = reconciled.respond(actor.memberId, value, now);
        const kind =
          previous === value
            ? undefined
            : !reconciled.isOpen(now)
              ? 'late_unavailability'
              : previous === 'unanswered'
                ? 'response_recorded'
                : 'response_modified';
        const after = await this.commit(
          tx,
          before,
          changed,
          now,
          actor.memberId,
          kind,
          actor.memberId,
        );
        return {
          revision,
          version: after.toRecord().version,
          response: after.response(actor.memberId),
          open: after.isOpen(now),
        };
      },
    );
  }

  close(
    actor: MemberActor,
    id: string,
    revision: number,
    expectedVersion: number,
  ) {
    return this.changeWindow(actor, id, revision, expectedVersion, null);
  }
  reopen(
    actor: MemberActor,
    id: string,
    revision: number,
    deadline: string,
    expectedVersion: number,
  ) {
    return this.changeWindow(actor, id, revision, expectedVersion, deadline);
  }
  private changeWindow(
    actor: MemberActor,
    id: string,
    revision: number,
    expectedVersion: number,
    deadline: string | null,
  ) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor);
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        if (!occurrence.canManageTeam(member))
          throw new AvailabilityError('FORBIDDEN');
        scheduled(occurrence);
        currentRevision(occurrence, revision);
        const before = await planIn(tx, actor.congregationId, id, revision);
        checkVersion(before.toRecord().version, expectedVersion);
        const now = this.now();
        let after = before
          .reconcile(await audienceIn(tx, occurrence))
          .expire(now);
        after = deadline === null ? after.close() : after.reopen(deadline, now);
        after = await this.commit(tx, before, after, now, actor.memberId);
        if (deadline !== null) await this.schedule(tx, after);
        return after.toRecord();
      },
    );
  }

  planning(actor: MemberActor, id: string): Promise<AvailabilityPlanning> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor);
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        if (!occurrence.canManageTeam(member))
          throw new AvailabilityError('FORBIDDEN');
        const revision = occurrence.toRecord().availabilityRevision;
        const plan = await planIn(tx, actor.congregationId, id, revision);
        const totals = plan.totals(await audienceIn(tx, occurrence));
        const minimum = occurrence.toRecord().configuration.quantities.minimum;
        return {
          revision,
          version: plan.toRecord().version,
          deadline: plan.toRecord().deadline,
          open:
            occurrence.toRecord().status === 'scheduled' &&
            plan.isOpen(this.now()),
          totals,
          belowMinimum:
            occurrence.toRecord().status === 'scheduled' &&
            minimum !== null &&
            totals.yes < minimum,
        };
      },
    );
  }
  mine(actor: MemberActor, id: string) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        scheduled(occurrence);
        if (!(await audienceIn(tx, occurrence)).includes(actor.memberId))
          throw new AvailabilityError('FORBIDDEN');
        const plan = await planIn(
          tx,
          actor.congregationId,
          id,
          occurrence.toRecord().availabilityRevision,
        );
        return {
          revision: plan.toRecord().revision,
          version: plan.toRecord().version,
          response: plan.response(actor.memberId),
          open: plan.isOpen(this.now()),
          deadline: plan.toRecord().deadline,
        };
      },
    );
  }

  /** Trusted server entry, never expose as an unauthenticated client command. */
  refresh(scope: string, id: string, revision: number): Promise<void> {
    return this.dependencies.transactions.run(scope, (tx) =>
      this.refreshIn(tx, scope, id, revision),
    );
  }
  /** Hook for the SAME transaction as member/assignment/cancellation changes. */
  async refreshIn(
    tx: AvailabilityUnitOfWork,
    scope: string,
    id: string,
    revision: number,
  ): Promise<void> {
    const occurrence = await occurrenceIn(tx, scope, id);
    if (occurrence.toRecord().availabilityRevision !== revision) return;
    if (occurrence.toRecord().status === 'cancelled') {
      await this.discardCancelledIn(tx, occurrence.toRecord(), this.now());
      return;
    }
    if (await tx.retention.find(scope, id)) return;
    const before = await tx.availability.find(scope, id, revision);
    if (!before) return;
    const now = this.now();
    const after = before
      .expire(now)
      .reconcile(await audienceIn(tx, occurrence));
    await this.commit(tx, before, after, now, null);
  }
  /** Required hook from maintenance rescheduling, inside its existing transaction. */
  async rescheduleIn(
    tx: AvailabilityUnitOfWork,
    input: AvailabilityReschedule,
  ): Promise<void> {
    const { before, after, deadlineDecision, occurredAt: now, actorId } = input;
    assertDeadlineDecision(deadlineDecision);
    instant(now);
    const stored = await occurrenceIn(tx, after.congregationId, after.id);
    if (
      stored.version !== after.version ||
      before.id !== after.id ||
      before.congregationId !== after.congregationId
    )
      throw new AvailabilityError('VERSION_CONFLICT');
    scheduled(stored);
    if (await tx.retention.find(after.congregationId, after.id))
      throw new AvailabilityError('AVAILABILITY_DISPOSED');
    const previous = await tx.availability.find(
      before.congregationId,
      before.id,
      before.availabilityRevision,
    );
    if (previous) {
      if (deadlineDecision.expectedVersion === null)
        throw new AvailabilityError('VERSION_CONFLICT');
      checkVersion(
        previous.toRecord().version,
        deadlineDecision.expectedVersion,
      );
    } else if (deadlineDecision.expectedVersion !== null)
      throw new AvailabilityError('VERSION_CONFLICT');
    if (!previous && deadlineDecision.kind === 'keep')
      throw new AvailabilityError('WINDOW_NOT_CONFIGURED');
    const deadline =
      deadlineDecision.kind === 'replace'
        ? deadlineDecision.deadline
        : previous?.toRecord().deadline;
    if (!deadline) throw new AvailabilityError('WINDOW_NOT_CONFIGURED');
    const audience = await audienceIn(tx, stored);
    if (
      previous &&
      before.availabilityRevision === after.availabilityRevision
    ) {
      const changed = previous
        .expire(now)
        .reconcile(audience)
        .changeDeadline(deadline)
        .expire(now);
      const next = await this.commit(
        tx,
        previous,
        changed,
        now,
        actorId,
        previous.toRecord().deadline === deadline
          ? undefined
          : 'deadline_changed',
      );
      if (previous.toRecord().deadline !== deadline)
        await this.schedule(tx, next);
    } else {
      const initial = AvailabilityPlan.create({
        congregationId: after.congregationId,
        occurrenceId: after.id,
        revision: after.availabilityRevision,
        deadline,
        audience,
      });
      const next = AvailabilityPlan.restore({
        ...initial.toRecord(),
        closed:
          (previous ? !previous.isOpen(now) : false) ||
          instant(now) >= instant(deadline),
      });
      if (!(await tx.availability.insertIfAbsent(next)))
        throw new AvailabilityError('VERSION_CONFLICT');
      await this.emit(tx, next, 'window_configured', now, actorId);
      if (next.toRecord().closed)
        await this.emit(tx, next, 'window_closed', now, actorId);
      if (after.availabilityRevision > before.availabilityRevision)
        await this.emit(tx, next, 'reconfirmation_required', now, actorId);
      if (next.isOpen(now))
        for (const memberId of audience)
          await this.emit(
            tx,
            next,
            'invitation_needed',
            now,
            actorId,
            memberId,
          );
      await this.schedule(tx, next);
    }
  }

  /** Trusted cancellation transaction hook; no fabricated completion status. */
  async discardCancelledIn(
    tx: AvailabilityUnitOfWork,
    record: import('../../domain/maintenance/MaintenanceOccurrence').OccurrenceRecord,
    now: string,
  ): Promise<void> {
    const stored = await occurrenceIn(tx, record.congregationId, record.id);
    if (
      stored.toRecord().status !== 'cancelled' ||
      stored.version !== record.version
    )
      throw new AvailabilityError('VERSION_CONFLICT');
    instant(now);
    await tx.retention.discardOccurrence({
      congregationId: record.congregationId,
      occurrenceId: record.id,
      terminal: 'cancelled',
      sourceVersion: record.version,
      effectiveAt: now,
    });
  }

  /** Durable deadline handler; stale generations/revisions are harmless no-ops. */
  closeDue(command: AvailabilityDeadline): Promise<void> {
    return this.dependencies.transactions.run(
      command.congregationId,
      async (tx) => {
        const occurrence = await occurrenceIn(
          tx,
          command.congregationId,
          command.occurrenceId,
        );
        if (occurrence.toRecord().availabilityRevision !== command.revision)
          return;
        const before = await tx.availability.find(
          command.congregationId,
          command.occurrenceId,
          command.revision,
        );
        if (
          !before ||
          before.toRecord().windowGeneration !== command.windowGeneration ||
          before.toRecord().deadline !== command.deadline
        )
          return;
        await this.refreshIn(
          tx,
          command.congregationId,
          command.occurrenceId,
          command.revision,
        );
      },
    );
  }
  private now(): string {
    const value = this.dependencies.clock.now();
    instant(value);
    return value;
  }

  private async commit(
    tx: AvailabilityUnitOfWork,
    before: AvailabilityPlan,
    changed: AvailabilityPlan,
    now: string,
    actorId: string | null,
    kind?: AvailabilityEventKind,
    memberId: string | null = null,
  ): Promise<AvailabilityPlan> {
    if (changed === before) return before;
    // Reconciliation, deadline and command changes form ONE atomic aggregate mutation.
    const after = AvailabilityPlan.restore({
      ...changed.toRecord(),
      version: before.toRecord().version + 1,
    });
    if (
      !(await tx.availability.saveIfVersion(after, before.toRecord().version))
    )
      throw new AvailabilityError('VERSION_CONFLICT');
    const old = before.toRecord(),
      next = after.toRecord();
    if ((!old.closed && next.closed) || (!old.closed && !before.isOpen(now)))
      await this.emit(tx, after, 'window_closed', now, actorId, null, {
        windowGeneration: old.windowGeneration,
      });
    if (
      next.windowGeneration !== old.windowGeneration &&
      kind !== 'deadline_changed'
    )
      await this.emit(tx, after, 'window_reopened', now, actorId);
    if (JSON.stringify(old.audience) !== JSON.stringify(next.audience)) {
      await this.emit(tx, after, 'eligibility_changed', now, actorId);
    }
    if (after.isOpen(now)) {
      for (const id of next.audience.filter(
        (id) =>
          (!old.audience.includes(id) ||
            next.windowGeneration !== old.windowGeneration) &&
          after.response(id) === 'unanswered',
      ))
        await this.emit(tx, after, 'invitation_needed', now, actorId, id);
    }
    if (kind) {
      await this.emit(tx, after, kind, now, actorId, memberId);
      if (kind === 'late_unavailability')
        await this.emit(tx, after, 'response_modified', now, actorId, memberId);
    }
    return after;
  }
  private schedule(tx: AvailabilityUnitOfWork, plan: AvailabilityPlan) {
    const {
      congregationId,
      occurrenceId,
      revision,
      deadline,
      windowGeneration,
    } = plan.toRecord();
    return tx.deadlines.schedule({
      congregationId,
      occurrenceId,
      revision,
      deadline,
      windowGeneration,
    });
  }
  private emit(
    tx: AvailabilityUnitOfWork,
    plan: AvailabilityPlan,
    kind: AvailabilityEventKind,
    now: string,
    actorId: string | null,
    memberId: string | null = null,
    metadata: { readonly windowGeneration?: number } = {},
  ) {
    const {
      congregationId,
      occurrenceId,
      revision,
      version,
      windowGeneration,
    } = plan.toRecord();
    return tx.events.append({
      id: [
        congregationId,
        occurrenceId,
        String(revision),
        String(version),
        kind,
        memberId ?? '',
      ]
        .map(encodeURIComponent)
        .join('/'),
      kind,
      congregationId,
      occurrenceId,
      revision,
      version,
      windowGeneration: metadata.windowGeneration ?? windowGeneration,
      actorId,
      invitationGeneration:
        kind === 'invitation_needed'
          ? (plan.toRecord().invitations.find((i) => i.memberId === memberId)
              ?.generation ?? null)
          : null,
      memberId,
      occurredAt: now,
    });
  }
}
