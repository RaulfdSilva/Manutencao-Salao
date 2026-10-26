import type { Member } from '../../domain/members/Member';
import type { MaintenanceOccurrence } from '../../domain/maintenance/MaintenanceOccurrence';
import type { MaintenanceCategory } from '../../domain/maintenance/MaintenanceTypes';
import {
  assertIdentifier,
  assertVersion,
} from '../../domain/maintenance/MaintenanceTypes';
import { MaintenanceError } from '../../domain/maintenance/MaintenanceError';
import { instant } from '../../domain/availability/AvailabilityPlan';
import { ChecklistError } from '../../domain/checklists/ChecklistError';
import { ChecklistTemplate } from '../../domain/checklists/ChecklistTemplate';
import { MaintenanceChecklist } from '../../domain/checklists/MaintenanceChecklist';
import { TechnicalProblem } from '../../domain/checklists/TechnicalProblem';
import { normalizeInput } from '../../domain/checklists/ChecklistTypes';
import type {
  VerificationDefinition,
  VerificationInput,
  VerificationResult,
} from '../../domain/checklists/ChecklistTypes';
import type { MemberActor } from '../members/MemberContracts';
import { completionDisposalRequest } from '../availability/AvailabilityContracts';
import type {
  ChecklistCommandReceipt,
  ChecklistCommandResult,
  ChecklistDependencies,
  ChecklistUnitOfWork,
  ChecklistTechnicalEvent,
} from './ChecklistContracts';

async function actorIn(
  tx: ChecklistUnitOfWork,
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
    throw new ChecklistError('FORBIDDEN');
  return member;
}
async function occurrenceIn(
  tx: ChecklistUnitOfWork,
  scope: string,
  id: string,
): Promise<MaintenanceOccurrence> {
  const occurrence = await tx.occurrences.findById(scope, id);
  if (!occurrence || occurrence.congregationId !== scope)
    throw new ChecklistError('NOT_FOUND');
  return occurrence;
}
async function checklistIn(
  tx: ChecklistUnitOfWork,
  scope: string,
  id: string,
): Promise<MaintenanceChecklist> {
  const checklist = await tx.checklists.find(scope, id);
  if (!checklist) throw new ChecklistError('CHECKLIST_NOT_INITIALIZED');
  return checklist;
}
function administrator(member: Member): void {
  if (!member.isActiveAdministrator) throw new ChecklistError('FORBIDDEN');
}
function scheduled(occurrence: MaintenanceOccurrence): void {
  if (occurrence.toRecord().status === 'cancelled')
    throw new MaintenanceError('OCCURRENCE_CANCELLED');
  if (occurrence.toRecord().status === 'completed')
    throw new MaintenanceError('OCCURRENCE_COMPLETED');
}
function checkVersion(actual: number, expected: number): void {
  assertVersion(expected);
  if (actual !== expected) throw new ChecklistError('VERSION_CONFLICT');
}
function manage(occurrence: MaintenanceOccurrence, member: Member): void {
  if (!occurrence.canManageTeam(member)) throw new ChecklistError('FORBIDDEN');
}
function fill(occurrence: MaintenanceOccurrence, member: Member): void {
  scheduled(occurrence);
  if (!occurrence.canParticipate(member)) throw new ChecklistError('FORBIDDEN');
}

function definitionRequest(
  input: VerificationDefinition,
): VerificationDefinition {
  return {
    taskId: input.taskId,
    taskDescription: input.taskDescription,
    equipmentCategoryId: input.equipmentCategoryId,
    equipmentCategoryName: input.equipmentCategoryName,
  };
}
function resultRequest(input: VerificationInput): VerificationInput {
  return input.status === 'problem_found'
    ? {
        status: input.status,
        description: input.description,
        photoReference: input.photoReference ?? null,
        ...(input.existingProblemId === undefined
          ? {}
          : { existingProblemId: input.existingProblemId }),
      }
    : { status: input.status };
}

/** Technical operations only. Server identity and database adapters are still required. */
export class ChecklistUseCases {
  constructor(private readonly dependencies: ChecklistDependencies) {}

  saveTemplate(
    actor: MemberActor,
    category: MaintenanceCategory,
    definitions: readonly VerificationDefinition[],
    expectedVersion: number | null,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      {
        operation: 'template',
        category,
        definitions: definitions.map(definitionRequest),
        expectedVersion,
      },
      async (_tx, member) => {
        administrator(member);
      },
      async (tx) => {
        const before = await tx.templates.find(actor.congregationId, category);
        let after: ChecklistTemplate;
        if (before) {
          if (expectedVersion === null)
            throw new ChecklistError('VERSION_CONFLICT');
          checkVersion(before.toRecord().version, expectedVersion);
          after = before.revise(definitions);
          if (
            after !== before &&
            !(await tx.templates.saveIfVersion(after, expectedVersion))
          )
            throw new ChecklistError('VERSION_CONFLICT');
        } else {
          if (expectedVersion !== null)
            throw new ChecklistError('VERSION_CONFLICT');
          after = ChecklistTemplate.create({
            congregationId: actor.congregationId,
            category,
            definitions,
          });
          if (!(await tx.templates.insertIfAbsent(after)))
            throw new ChecklistError('VERSION_CONFLICT');
        }
        if (after !== before)
          await this.event(
            tx,
            actor.congregationId,
            null,
            commandId,
            'template_updated',
            after.toRecord().version,
          );
        return { templateVersion: after.toRecord().version };
      },
    );
  }

  createChecklist(
    actor: MemberActor,
    id: string,
    expectedOccurrenceVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      { operation: 'create', id, expectedOccurrenceVersion },
      async (tx, member) => {
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        fill(occurrence, member);
        return occurrence;
      },
      async (tx, occurrence) => {
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const existing = await tx.checklists.find(actor.congregationId, id);
        if (existing) return { checklistVersion: existing.toRecord().version };
        const template = await tx.templates.find(
          actor.congregationId,
          occurrence.toRecord().category,
        );
        if (!template) throw new ChecklistError('TEMPLATE_NOT_CONFIGURED');
        const checklist = MaintenanceChecklist.create(id, template);
        if (!(await tx.checklists.insertIfAbsent(checklist)))
          throw new ChecklistError('VERSION_CONFLICT');
        await this.event(
          tx,
          actor.congregationId,
          id,
          commandId,
          'checklist_created',
          1,
        );
        return { checklistVersion: 1 };
      },
    );
  }

  addOccasional(
    actor: MemberActor,
    id: string,
    definition: VerificationDefinition,
    expectedChecklistVersion: number,
    expectedOccurrenceVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      {
        operation: 'occasional',
        id,
        definition: definitionRequest(definition),
        expectedChecklistVersion,
        expectedOccurrenceVersion,
      },
      async (tx, member) => {
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        scheduled(occurrence);
        manage(occurrence, member);
        return occurrence;
      },
      async (tx, occurrence) => {
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const before = await checklistIn(tx, actor.congregationId, id);
        checkVersion(before.toRecord().version, expectedChecklistVersion);
        const after = before.addOccasional(definition);
        await this.saveChecklist(tx, before, after);
        await this.event(
          tx,
          actor.congregationId,
          id,
          commandId,
          'occasional_added',
          after.toRecord().version,
        );
        return { checklistVersion: after.toRecord().version };
      },
    );
  }

  recordResult(
    actor: MemberActor,
    id: string,
    key: string,
    input: VerificationInput,
    expectedChecklistVersion: number,
    expectedOccurrenceVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      {
        operation: 'result',
        id,
        key,
        input: resultRequest(input),
        expectedChecklistVersion,
        expectedOccurrenceVersion,
      },
      async (tx, member) => {
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        fill(occurrence, member);
        return occurrence;
      },
      async (tx, occurrence) => {
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const before = await checklistIn(tx, actor.congregationId, id);
        checkVersion(before.toRecord().version, expectedChecklistVersion);
        const result = await this.resultIn(tx, before, key, input);
        const after = before.recordResult(key, result);
        await this.saveChecklist(tx, before, after);
        if (after !== before)
          await this.event(
            tx,
            actor.congregationId,
            id,
            commandId,
            'result_recorded',
            after.toRecord().version,
          );
        return {
          checklistVersion: after.toRecord().version,
          ...(result.problemId === null ? {} : { problemId: result.problemId }),
        };
      },
    );
  }

  previewCompletion(actor: MemberActor, id: string) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor),
          occurrence = await occurrenceIn(tx, actor.congregationId, id);
        manage(occurrence, member);
        scheduled(occurrence);
        const checklist = await checklistIn(tx, actor.congregationId, id);
        const openProblems = (
          await tx.problems.list(actor.congregationId, id)
        ).filter((p) => p.toRecord().status === 'pending').length;
        return {
          occurrenceVersion: occurrence.version,
          checklistVersion: checklist.toRecord().version,
          summary: checklist.summary(),
          openProblems,
        };
      },
    );
  }

  complete(
    actor: MemberActor,
    id: string,
    expectedChecklistVersion: number,
    expectedOccurrenceVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      {
        operation: 'complete',
        id,
        expectedChecklistVersion,
        expectedOccurrenceVersion,
      },
      async (tx, member) => {
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        manage(occurrence, member);
        return occurrence;
      },
      async (tx, occurrence) => {
        scheduled(occurrence);
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const before = await checklistIn(tx, actor.congregationId, id);
        checkVersion(before.toRecord().version, expectedChecklistVersion);
        const now = this.now(),
          sealed = before.seal(now),
          completed = occurrence.complete();
        await this.saveChecklist(tx, before, sealed);
        if (
          !(await tx.occurrences.saveIfVersion(
            completed,
            expectedOccurrenceVersion,
          ))
        )
          throw new ChecklistError('VERSION_CONFLICT');
        const receipt = {
          congregationId: actor.congregationId,
          occurrenceId: id,
          sourceVersion: completed.version,
          completedAt: now,
        };
        await tx.technicalHistory.recordCompletion(receipt);
        await tx.retention.discardOccurrence(
          completionDisposalRequest(receipt),
        );
        await this.event(
          tx,
          actor.congregationId,
          id,
          commandId,
          'maintenance_completed',
          completed.version,
          now,
        );
        return {
          occurrenceVersion: completed.version,
          checklistVersion: sealed.toRecord().version,
          summary: sealed.summary(),
        };
      },
    );
  }

  correct(
    actor: MemberActor,
    id: string,
    key: string,
    input: VerificationInput,
    nature: string,
    expectedChecklistVersion: number,
    expectedOccurrenceVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      {
        operation: 'correction',
        id,
        key,
        input: resultRequest(input),
        nature,
        expectedChecklistVersion,
        expectedOccurrenceVersion,
      },
      async (tx, member) => {
        administrator(member);
        const occurrence = await occurrenceIn(tx, actor.congregationId, id);
        if (occurrence.toRecord().status === 'cancelled')
          throw new MaintenanceError('OCCURRENCE_CANCELLED');
        if (occurrence.toRecord().status !== 'completed')
          throw new ChecklistError('CORRECTION_REQUIRES_COMPLETION');
        return occurrence;
      },
      async (tx, occurrence) => {
        checkVersion(occurrence.version, expectedOccurrenceVersion);
        const before = await checklistIn(tx, actor.congregationId, id);
        checkVersion(before.toRecord().version, expectedChecklistVersion);
        const result = await this.resultIn(tx, before, key, input),
          after = before.correct(key, result, commandId, nature, this.now());
        await this.saveChecklist(tx, before, after);
        if (after !== before)
          await this.event(
            tx,
            actor.congregationId,
            id,
            commandId,
            'checklist_corrected',
            after.toRecord().version,
          );
        return {
          checklistVersion: after.toRecord().version,
          occurrenceVersion: occurrence.version,
          ...(result.problemId === null ? {} : { problemId: result.problemId }),
        };
      },
    );
  }

  getChecklist(actor: MemberActor, id: string) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        await occurrenceIn(tx, actor.congregationId, id);
        return (await checklistIn(tx, actor.congregationId, id)).toRecord();
      },
    );
  }
  listProblems(actor: MemberActor, id: string, onlyOpen = true) {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        await actorIn(tx, actor);
        await occurrenceIn(tx, actor.congregationId, id);
        return (await tx.problems.list(actor.congregationId, id))
          .map((p) => p.toRecord())
          .filter((p) => !onlyOpen || p.status === 'pending');
      },
    );
  }

  resolveProblem(
    actor: MemberActor,
    problemId: string,
    expectedProblemVersion: number,
    commandId: string,
  ): Promise<ChecklistCommandReceipt> {
    return this.command(
      actor,
      commandId,
      { operation: 'resolve', problemId, expectedProblemVersion },
      async (tx, member) => {
        const problem = await tx.problems.find(actor.congregationId, problemId);
        if (!problem) throw new ChecklistError('NOT_FOUND');
        const occurrence = await occurrenceIn(
          tx,
          actor.congregationId,
          problem.toRecord().occurrenceId,
        );
        if (occurrence.toRecord().status === 'cancelled')
          throw new MaintenanceError('OCCURRENCE_CANCELLED');
        manage(occurrence, member);
        return problem;
      },
      async (tx, before) => {
        checkVersion(before.toRecord().version, expectedProblemVersion);
        const after = before.resolve(this.now());
        if (after !== before) {
          if (!(await tx.problems.saveIfVersion(after, expectedProblemVersion)))
            throw new ChecklistError('VERSION_CONFLICT');
          await this.event(
            tx,
            actor.congregationId,
            after.toRecord().occurrenceId,
            commandId,
            'problem_resolved',
            after.toRecord().version,
          );
        }
        return { problemId: after.toRecord().id };
      },
    );
  }

  private async resultIn(
    tx: ChecklistUnitOfWork,
    checklist: MaintenanceChecklist,
    key: string,
    input: VerificationInput,
  ): Promise<VerificationResult> {
    checklist.verification(key);
    const normalized = normalizeInput(input),
      record = checklist.toRecord();
    if (normalized.status !== 'problem_found')
      return {
        status: normalized.status,
        description: null,
        photoReference: null,
        problemId: null,
      };
    const photoReference = normalized.photoReference ?? null;
    if (normalized.existingProblemId !== undefined) {
      const problem = await tx.problems.find(
          record.congregationId,
          normalized.existingProblemId,
        ),
        source = problem?.toRecord();
      if (
        !source ||
        source.occurrenceId !== record.occurrenceId ||
        source.verificationKey !== key
      )
        throw new ChecklistError('INVALID_PROBLEM_LINK');
      if (
        source.description !== normalized.description ||
        source.photoReference !== photoReference
      )
        throw new ChecklistError('PROBLEM_DETAILS_MISMATCH');
      return {
        status: 'problem_found',
        description: normalized.description,
        photoReference,
        problemId: source.id,
      };
    }
    const problem = TechnicalProblem.create({
      id: this.dependencies.ids.next(),
      congregationId: record.congregationId,
      occurrenceId: record.occurrenceId,
      verificationKey: key,
      description: normalized.description,
      photoReference,
      recordedAt: this.now(),
    });
    await tx.problems.insert(problem);
    return {
      status: 'problem_found',
      description: normalized.description,
      photoReference,
      problemId: problem.toRecord().id,
    };
  }
  private async saveChecklist(
    tx: ChecklistUnitOfWork,
    before: MaintenanceChecklist,
    after: MaintenanceChecklist,
  ): Promise<void> {
    if (
      before !== after &&
      !(await tx.checklists.saveIfVersion(after, before.toRecord().version))
    )
      throw new ChecklistError('VERSION_CONFLICT');
  }
  private command<C>(
    actor: MemberActor,
    commandId: string,
    request: object,
    authorize: (tx: ChecklistUnitOfWork, member: Member) => Promise<C>,
    effect: (
      tx: ChecklistUnitOfWork,
      context: C,
    ) => Promise<ChecklistCommandResult>,
  ): Promise<ChecklistCommandReceipt> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const member = await actorIn(tx, actor),
          context = await authorize(tx, member);
        assertIdentifier(commandId);
        const serialized = JSON.stringify(request);
        const previous = await tx.receipts.find(
          actor.congregationId,
          commandId,
        );
        if (previous) {
          if (previous.request !== serialized)
            throw new ChecklistError('COMMAND_ID_REUSED');
          return previous;
        }
        const result = Object.freeze(await effect(tx, context));
        const receipt = Object.freeze({
          congregationId: actor.congregationId,
          commandId,
          request: serialized,
          result,
        });
        await tx.receipts.insert(receipt);
        return receipt;
      },
    );
  }
  private now(): string {
    const value = this.dependencies.clock.now();
    instant(value);
    return value;
  }
  private event(
    tx: ChecklistUnitOfWork,
    scope: string,
    id: string | null,
    commandId: string,
    kind: ChecklistTechnicalEvent['kind'],
    version: number,
    now = this.now(),
  ) {
    return tx.events.append({
      id: [scope, commandId, kind].map(encodeURIComponent).join('/'),
      congregationId: scope,
      occurrenceId: id,
      kind,
      version,
      occurredAt: now,
    });
  }
}
