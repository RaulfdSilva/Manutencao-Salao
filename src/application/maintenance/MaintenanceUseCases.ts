import type { Member } from '../../domain/members/Member';
import { assertRange } from '../../domain/maintenance/Calendar';
import type { DateRange } from '../../domain/maintenance/Calendar';
import { MaintenanceOccurrence } from '../../domain/maintenance/MaintenanceOccurrence';
import type {
  NewOccurrence,
  OccurrenceRecord,
} from '../../domain/maintenance/MaintenanceOccurrence';
import { assertVersion } from '../../domain/maintenance/MaintenanceTypes';
import type {
  AvailabilityDecision,
  MaintenanceConfiguration,
  MaintenanceSchedule,
} from '../../domain/maintenance/MaintenanceTypes';
import { RecurrenceRule } from '../../domain/maintenance/RecurrenceRule';
import type {
  RecurrenceRuleRecord,
  RecurrenceSettings,
} from '../../domain/maintenance/RecurrenceRule';
import type { MemberActor } from '../members/MemberContracts';
import type {
  MaintenanceDependencies,
  MaintenanceEventEnvelope,
  MaintenanceUnitOfWork,
} from './MaintenanceContracts';
import { MaintenanceOperationError } from './MaintenanceOperationError';

async function actorIn(
  tx: MaintenanceUnitOfWork,
  actor: MemberActor,
): Promise<Member> {
  const member = await tx.members.findById(
    actor.congregationId,
    actor.memberId,
  );
  if (!member || member.status !== 'active')
    throw new MaintenanceOperationError('FORBIDDEN');
  return member;
}
function requireAdministrator(member: Member): void {
  if (!member.isActiveAdministrator)
    throw new MaintenanceOperationError('FORBIDDEN');
}
function requireVersion(actual: number, expected: number): void {
  assertVersion(expected);
  if (actual !== expected)
    throw new MaintenanceOperationError('VERSION_CONFLICT');
}
async function ruleIn(
  tx: MaintenanceUnitOfWork,
  scope: string,
  id: string,
): Promise<RecurrenceRule> {
  const rule = await tx.rules.findById(scope, id);
  if (!rule) throw new MaintenanceOperationError('RULE_NOT_FOUND');
  return rule;
}
async function occurrenceIn(
  tx: MaintenanceUnitOfWork,
  scope: string,
  id: string,
): Promise<MaintenanceOccurrence> {
  const occurrence = await tx.occurrences.findById(scope, id);
  if (!occurrence) throw new MaintenanceOperationError('OCCURRENCE_NOT_FOUND');
  return occurrence;
}
async function validateConfiguration(
  tx: MaintenanceUnitOfWork,
  scope: string,
  configuration: MaintenanceConfiguration,
): Promise<void> {
  for (const id of configuration.responsibleMemberIds) {
    const member = await tx.members.findById(scope, id);
    if (
      !member ||
      member.status !== 'active' ||
      member.role !== 'maintenance_manager'
    )
      throw new MaintenanceOperationError('MEMBER_NOT_ELIGIBLE');
  }
}

export class MaintenanceUseCases {
  constructor(private readonly dependencies: MaintenanceDependencies) {}

  approveRule(
    actor: MemberActor,
    settings: RecurrenceSettings,
  ): Promise<RecurrenceRuleRecord> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        requireAdministrator(await actorIn(tx, actor));
        const rule = RecurrenceRule.approve({
          id: this.dependencies.ids.next(),
          congregationId: actor.congregationId,
          category: settings.category,
          startsOn: settings.startsOn,
          endsOn: settings.endsOn,
          pattern: settings.pattern,
          defaults: settings.defaults,
          time: settings.time,
          timeZone: settings.timeZone,
          approvedBy: actor.memberId,
          approvedAt: this.dependencies.clock.now(),
        });
        await validateConfiguration(
          tx,
          actor.congregationId,
          rule.toRecord().defaults,
        );
        await tx.rules.insert(rule);
        await tx.events.append({
          ...this.envelope(actor, 'rule', rule.id, rule.version),
          kind: 'rule_approved',
          before: null,
          after: rule.toRecord(),
        });
        return rule.toRecord();
      },
    );
  }

  reviseRule(
    actor: MemberActor,
    ruleId: string,
    settings: RecurrenceSettings,
    expectedVersion: number,
  ): Promise<RecurrenceRuleRecord> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        requireAdministrator(await actorIn(tx, actor));
        const before = await ruleIn(tx, actor.congregationId, ruleId);
        requireVersion(before.version, expectedVersion);
        const after = before.revise(
          settings,
          actor.memberId,
          this.dependencies.clock.now(),
        );
        await validateConfiguration(
          tx,
          actor.congregationId,
          after.toRecord().defaults,
        );
        if (!(await tx.rules.saveIfVersion(after, expectedVersion)))
          throw new MaintenanceOperationError('VERSION_CONFLICT');
        await tx.events.append({
          ...this.envelope(actor, 'rule', ruleId, after.version),
          kind: 'rule_revised',
          before: before.toRecord(),
          after: after.toRecord(),
        });
        return after.toRecord();
      },
    );
  }

  generate(
    actor: MemberActor,
    ruleId: string,
    range: DateRange,
    expectedRuleVersion: number,
  ): Promise<readonly OccurrenceRecord[]> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        requireAdministrator(await actorIn(tx, actor));
        const rule = await ruleIn(tx, actor.congregationId, ruleId);
        requireVersion(rule.version, expectedRuleVersion);
        const settings = rule.toRecord();
        const result: OccurrenceRecord[] = [];
        for (const slot of rule.slots(range)) {
          const candidate = MaintenanceOccurrence.create({
            id: this.dependencies.ids.next(),
            congregationId: actor.congregationId,
            category: settings.category,
            source: {
              ruleId,
              slotDate: slot.date,
              weekendStart: slot.weekendStart,
            },
            schedule: {
              date: slot.date,
              time: settings.time,
              timeZone: settings.timeZone,
            },
            configuration: settings.defaults,
            assignedMemberIds: [],
          });
          const stored =
            await tx.occurrences.insertGeneratedIfAbsent(candidate);
          if (stored.inserted) {
            await validateConfiguration(
              tx,
              actor.congregationId,
              candidate.toRecord().configuration,
            );
            await tx.events.append({
              ...this.envelope(actor, 'occurrence', candidate.id, 1),
              kind: 'occurrence_created',
              before: null,
              after: candidate.toRecord(),
              invalidatesReminderVersionsThrough: null,
            });
          }
          result.push(stored.occurrence.toRecord());
        }
        return Object.freeze(result);
      },
    );
  }

  createOccurrence(
    actor: MemberActor,
    input: Pick<NewOccurrence, 'category' | 'schedule' | 'configuration'>,
  ): Promise<OccurrenceRecord> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        requireAdministrator(await actorIn(tx, actor));
        const occurrence = MaintenanceOccurrence.create({
          id: this.dependencies.ids.next(),
          congregationId: actor.congregationId,
          category: input.category,
          schedule: input.schedule,
          configuration: input.configuration,
          source: null,
          assignedMemberIds: [],
        });
        await validateConfiguration(
          tx,
          actor.congregationId,
          occurrence.toRecord().configuration,
        );
        await tx.occurrences.insert(occurrence);
        await tx.events.append({
          ...this.envelope(actor, 'occurrence', occurrence.id, 1),
          kind: 'occurrence_created',
          before: null,
          after: occurrence.toRecord(),
          invalidatesReminderVersionsThrough: null,
        });
        return occurrence.toRecord();
      },
    );
  }

  get(actor: MemberActor, occurrenceId: string): Promise<OccurrenceRecord> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        return (
          await occurrenceIn(tx, actor.congregationId, occurrenceId)
        ).toRecord();
      },
    );
  }
  list(
    actor: MemberActor,
    range: DateRange,
  ): Promise<readonly OccurrenceRecord[]> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        assertRange(range);
        return (await tx.occurrences.list(actor.congregationId, range)).map(
          (occurrence) => occurrence.toRecord(),
        );
      },
    );
  }
  participation(
    actor: MemberActor,
    occurrenceId: string,
  ): Promise<{
    readonly allowed: boolean;
    readonly planningWarning: 'below_minimum' | null;
  }> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor);
        const occurrence = await occurrenceIn(
          tx,
          actor.congregationId,
          occurrenceId,
        );
        return {
          allowed: occurrence.canParticipate(member),
          planningWarning: occurrence.planningWarning(),
        };
      },
    );
  }

  reschedule(
    actor: MemberActor,
    occurrenceId: string,
    schedule: MaintenanceSchedule,
    decision: AvailabilityDecision,
    expectedVersion: number,
  ): Promise<{
    readonly occurrence: OccurrenceRecord;
    readonly reconfirmationRecommended: boolean;
  }> {
    return this.change(
      actor,
      occurrenceId,
      expectedVersion,
      'administrator',
      async (tx, before) => {
        const after = before.reschedule(schedule, decision);
        const recommendation =
          before.toRecord().schedule.date !== after.toRecord().schedule.date;
        if (after !== before) {
          await this.save(tx, before, after);
          await tx.events.append({
            ...this.envelope(actor, 'occurrence', occurrenceId, after.version),
            kind: 'occurrence_rescheduled',
            before: before.toRecord(),
            after: after.toRecord(),
            invalidatesReminderVersionsThrough: before.version,
            availabilityDecision: decision,
            reconfirmationRecommended: recommendation,
          });
        }
        return {
          occurrence: after.toRecord(),
          reconfirmationRecommended: recommendation,
        };
      },
    );
  }
  cancel(
    actor: MemberActor,
    occurrenceId: string,
    expectedVersion: number,
  ): Promise<OccurrenceRecord> {
    return this.editOccurrence(
      actor,
      occurrenceId,
      expectedVersion,
      'occurrence_cancelled',
      (occurrence) => occurrence.cancel(),
    );
  }
  configure(
    actor: MemberActor,
    occurrenceId: string,
    configuration: MaintenanceConfiguration,
    expectedVersion: number,
  ): Promise<OccurrenceRecord> {
    return this.editOccurrence(
      actor,
      occurrenceId,
      expectedVersion,
      'occurrence_configured',
      (occurrence) => occurrence.configure(configuration),
    );
  }
  assignTeam(
    actor: MemberActor,
    occurrenceId: string,
    ids: readonly string[],
    expectedVersion: number,
  ): Promise<OccurrenceRecord> {
    return this.editOccurrence(
      actor,
      occurrenceId,
      expectedVersion,
      'team_changed',
      (occurrence) => occurrence.assignTeam(ids),
    );
  }

  private editOccurrence(
    actor: MemberActor,
    id: string,
    expectedVersion: number,
    kind: 'occurrence_cancelled' | 'occurrence_configured' | 'team_changed',
    transform: (before: MaintenanceOccurrence) => MaintenanceOccurrence,
  ): Promise<OccurrenceRecord> {
    return this.change(
      actor,
      id,
      expectedVersion,
      kind === 'team_changed' ? 'team_manager' : 'administrator',
      async (tx, before) => {
        const after = transform(before);
        if (after === before) return before.toRecord();
        if (kind === 'occurrence_configured') {
          await validateConfiguration(
            tx,
            actor.congregationId,
            after.toRecord().configuration,
          );
        }
        if (kind === 'team_changed') {
          for (const memberId of after.toRecord().assignedMemberIds) {
            const member = await tx.members.findById(
              actor.congregationId,
              memberId,
            );
            if (!member || member.status !== 'active')
              throw new MaintenanceOperationError('MEMBER_NOT_ELIGIBLE');
          }
        }
        await this.save(tx, before, after);
        await tx.events.append({
          ...this.envelope(actor, 'occurrence', id, after.version),
          kind,
          before: before.toRecord(),
          after: after.toRecord(),
          invalidatesReminderVersionsThrough: before.version,
        });
        return after.toRecord();
      },
    );
  }
  private change<T>(
    actor: MemberActor,
    id: string,
    expectedVersion: number,
    authority: 'administrator' | 'team_manager',
    work: (
      tx: MaintenanceUnitOfWork,
      before: MaintenanceOccurrence,
    ) => Promise<T>,
  ): Promise<T> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const requester = await actorIn(tx, actor);
        const before = await occurrenceIn(tx, actor.congregationId, id);
        // Check authority before returning version information or performing any changes.
        if (
          authority === 'administrator'
            ? !requester.isActiveAdministrator
            : !before.canManageTeam(requester)
        )
          throw new MaintenanceOperationError('FORBIDDEN');
        requireVersion(before.version, expectedVersion);
        return work(tx, before);
      },
    );
  }
  private async save(
    tx: MaintenanceUnitOfWork,
    before: MaintenanceOccurrence,
    after: MaintenanceOccurrence,
  ): Promise<void> {
    if (!(await tx.occurrences.saveIfVersion(after, before.version)))
      throw new MaintenanceOperationError('VERSION_CONFLICT');
  }
  private envelope(
    actor: MemberActor,
    aggregate: 'rule' | 'occurrence',
    id: string,
    version: number,
  ): MaintenanceEventEnvelope {
    return {
      id: `${encodeURIComponent(actor.congregationId)}/${aggregate}/${encodeURIComponent(id)}/${version}`,
      congregationId: actor.congregationId,
      actorId: actor.memberId,
      occurredAt: this.dependencies.clock.now(),
    };
  }
}
