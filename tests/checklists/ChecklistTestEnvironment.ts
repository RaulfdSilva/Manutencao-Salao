import {
  AvailabilityTestEnvironment,
  admin,
} from '../availability/AvailabilityTestEnvironment';
import { ChecklistUseCases } from '../../src/application/checklists/ChecklistUseCases';
import type {
  ChecklistCommandReceipt,
  ChecklistDependencies,
  ChecklistTechnicalEvent,
  ChecklistUnitOfWork,
} from '../../src/application/checklists/ChecklistContracts';
import { AvailabilityUseCases } from '../../src/application/availability/AvailabilityUseCases';
import type { AvailabilityUnitOfWork } from '../../src/application/availability/AvailabilityContracts';
import { MaintenanceUseCases } from '../../src/application/maintenance/MaintenanceUseCases';
import type { MaintenanceUnitOfWork } from '../../src/application/maintenance/MaintenanceContracts';
import type { AnnualMaintenanceRecord } from '../../src/application/maintenance/MaintenanceLifecycleContracts';
import { ChecklistError } from '../../src/domain/checklists/ChecklistError';
import { ChecklistTemplate } from '../../src/domain/checklists/ChecklistTemplate';
import { MaintenanceChecklist } from '../../src/domain/checklists/MaintenanceChecklist';
import { TechnicalProblem } from '../../src/domain/checklists/TechnicalProblem';
import { verificationKey } from '../../src/domain/checklists/ChecklistTypes';
import type { VerificationDefinition } from '../../src/domain/checklists/ChecklistTypes';
import { RecurrenceRule } from '../../src/domain/maintenance/RecurrenceRule';

/** Synthetic configuration, not a transcription or recommendation from the official matrix. */
export const definitions = [
  {
    taskId: 'synthetic-task',
    taskDescription: 'Verificação sintética A',
    equipmentCategoryId: 'synthetic-category-a',
    equipmentCategoryName: 'Categoria sintética A',
  },
  {
    taskId: 'synthetic-task',
    taskDescription: 'Verificação sintética A',
    equipmentCategoryId: 'synthetic-category-b',
    equipmentCategoryName: 'Categoria sintética B',
  },
] as const satisfies readonly VerificationDefinition[];
export const firstKey = verificationKey(
  'synthetic-task',
  'synthetic-category-a',
);
export const secondKey = verificationKey(
  'synthetic-task',
  'synthetic-category-b',
);
const key = (scope: string, id: string) => JSON.stringify([scope, id]);

/** One test-only serialized transaction across all modules. This is not a database or authentication implementation. */
export class ChecklistTestEnvironment extends AvailabilityTestEnvironment {
  templates = new Map<string, ChecklistTemplate>();
  checklists = new Map<string, MaintenanceChecklist>();
  problems = new Map<string, TechnicalProblem>();
  receipts = new Map<string, ChecklistCommandReceipt>();
  checklistEvents: ChecklistTechnicalEvent[] = [];
  annual = new Map<string, AnnualMaintenanceRecord>();
  rules = new Map<string, RecurrenceRule>();
  completionWrites = 0;
  rejectChecklistSave = false;
  rejectOccurrenceSave = false;
  rejectTemplateSave = false;
  rejectProblemSave = false;
  failChecklistEvents = false;
  failReceipts = false;
  failAnnual = false;
  private sequence = 0;
  private commandSequence = 0;
  readonly dependencies: ChecklistDependencies = {
    transactions: { run: (scope, work) => this.runChecklist(scope, work) },
    clock: this.clock,
    ids: { next: () => `technical-${++this.sequence}` },
  };
  readonly service = new ChecklistUseCases(this.dependencies);
  readonly availabilityService = new AvailabilityUseCases(this);
  readonly maintenanceService = new MaintenanceUseCases({
    clock: this.clock,
    ids: this.dependencies.ids,
    transactions: { run: (scope, work) => this.runMaintenance(scope, work) },
  });
  constructor() {
    super();
    const occurrence = this.occurrences.get('occurrence');
    if (!occurrence) throw new Error('Missing occurrence');
    const record = occurrence.toRecord();
    this.annual.set(key(record.congregationId, record.id), {
      congregationId: record.congregationId,
      occurrenceId: record.id,
      category: record.category,
      firstScheduled: record.schedule,
      latestScheduled: record.schedule,
      status: 'scheduled',
      completedAt: null,
      cancelledAt: null,
      sourceVersion: record.version,
    });
  }
  command(): string {
    return `command-${++this.commandSequence}`;
  }
  checklist(id = 'occurrence', scope = 'congregation'): MaintenanceChecklist {
    const result = this.checklists.get(key(scope, id));
    if (!result) throw new Error('Missing checklist');
    return result;
  }
  async setup(): Promise<void> {
    await this.service.saveTemplate(
      admin,
      'fortnightly',
      definitions,
      null,
      this.command(),
    );
    await this.service.createChecklist(
      admin,
      'occurrence',
      this.occurrences.get('occurrence')?.version ?? 1,
      this.command(),
    );
  }
  runChecklist<T>(
    scope: string,
    work: (tx: ChecklistUnitOfWork) => Promise<T>,
  ): Promise<T> {
    return super.run(scope, (av) =>
      this.withRollback(() => work(this.checklistTransaction(scope, av))),
    );
  }
  runMaintenance<T>(
    scope: string,
    work: (tx: MaintenanceUnitOfWork) => Promise<T>,
  ): Promise<T> {
    return super.run(scope, (av) =>
      this.withRollback(() => {
        const tx = this.checklistTransaction(scope, av);
        return work({
          members: av.members,
          occurrences: {
            ...tx.occurrences,
            list: async (congregationId, range) =>
              [...this.occurrences.values()].filter(
                (o) =>
                  congregationId === scope &&
                  o.congregationId === scope &&
                  o.toRecord().schedule.date >= range.from &&
                  o.toRecord().schedule.date <= range.to,
              ),
            insert: async (occurrence) => {
              if (this.occurrences.has(occurrence.id))
                throw new Error('Duplicate occurrence');
              this.occurrences.set(occurrence.id, occurrence);
            },
            insertGeneratedIfAbsent: async (occurrence) => {
              const source = occurrence.toRecord().source;
              if (!source || occurrence.congregationId !== scope)
                throw new Error('Invalid generated occurrence');
              const existing = [...this.occurrences.values()].find(
                (o) =>
                  o.congregationId === scope &&
                  o.toRecord().source?.ruleId === source.ruleId &&
                  o.toRecord().source?.cycleKey === source.cycleKey,
              );
              if (existing) return { inserted: false, occurrence: existing };
              if (this.occurrences.has(occurrence.id))
                throw new Error('Duplicate occurrence');
              this.occurrences.set(occurrence.id, occurrence);
              return { inserted: true, occurrence };
            },
          },
          rules: {
            findById: async (congregationId, id) =>
              congregationId === scope
                ? (this.rules.get(key(scope, id)) ?? null)
                : null,
            insert: async (rule) => {
              const id = key(scope, rule.id);
              if (rule.congregationId !== scope || this.rules.has(id))
                throw new Error('Duplicate/wrong scope rule');
              this.rules.set(id, rule);
            },
            saveIfVersion: async (rule, expected) => {
              const id = key(scope, rule.id),
                current = this.rules.get(id);
              if (
                current?.version !== expected ||
                rule.congregationId !== scope
              )
                return false;
              if (rule.version !== expected + 1)
                throw new Error('Wrong version');
              this.rules.set(id, rule);
              return true;
            },
          },
          technicalHistory: tx.technicalHistory,
          events: {
            append: async (event) => {
              this.maintenanceEvents.push(event);
              if (this.failEvents) throw new Error('Event storage failed');
            },
          },
          lifecycle: {
            availabilityAudienceChanged: (record) =>
              this.availabilityService.refreshIn(
                av,
                scope,
                record.id,
                record.availabilityRevision,
              ),
            availabilityRescheduled: (input) =>
              this.availabilityService.rescheduleIn(av, input),
            availabilityCancelled: (record, now) =>
              this.availabilityService.discardCancelledIn(av, record, now),
          },
        });
      }),
    );
  }
  private async withRollback<T>(work: () => Promise<T>): Promise<T> {
    const snapshot = {
      templates: new Map(this.templates),
      checklists: new Map(this.checklists),
      problems: new Map(this.problems),
      receipts: new Map(this.receipts),
      annual: new Map(this.annual),
      rules: new Map(this.rules),
      events: [...this.checklistEvents],
      completionWrites: this.completionWrites,
    };
    try {
      return await work();
    } catch (error) {
      this.templates = snapshot.templates;
      this.checklists = snapshot.checklists;
      this.problems = snapshot.problems;
      this.receipts = snapshot.receipts;
      this.annual = snapshot.annual;
      this.rules = snapshot.rules;
      this.checklistEvents = snapshot.events;
      this.completionWrites = snapshot.completionWrites;
      throw error;
    }
  }
  private checklistTransaction(
    scope: string,
    av: AvailabilityUnitOfWork,
  ): ChecklistUnitOfWork {
    return {
      members: av.members,
      occurrences: {
        findById: av.occurrences.findById,
        saveIfVersion: async (occurrence, expected) => {
          const current = this.occurrences.get(occurrence.id);
          if (
            this.rejectOccurrenceSave ||
            occurrence.congregationId !== scope ||
            current?.congregationId !== scope ||
            current.version !== expected
          )
            return false;
          if (occurrence.version !== expected + 1)
            throw new Error('Wrong occurrence version');
          this.occurrences.set(occurrence.id, occurrence);
          return true;
        },
      },
      templates: {
        find: async (congregationId, category) =>
          congregationId === scope
            ? (this.templates.get(key(scope, category)) ?? null)
            : null,
        insertIfAbsent: async (template) => {
          const record = template.toRecord(),
            id = key(scope, record.category);
          if (record.congregationId !== scope || this.templates.has(id))
            return false;
          this.templates.set(id, template);
          return true;
        },
        saveIfVersion: async (template, expected) => {
          const record = template.toRecord(),
            id = key(scope, record.category);
          if (
            this.rejectTemplateSave ||
            record.congregationId !== scope ||
            this.templates.get(id)?.toRecord().version !== expected
          )
            return false;
          if (record.version !== expected + 1)
            throw new Error('Wrong template version');
          this.templates.set(id, template);
          return true;
        },
      },
      checklists: {
        find: async (congregationId, id) =>
          congregationId === scope
            ? (this.checklists.get(key(scope, id)) ?? null)
            : null,
        insertIfAbsent: async (checklist) => {
          const record = checklist.toRecord(),
            id = key(scope, record.occurrenceId);
          if (record.congregationId !== scope || this.checklists.has(id))
            return false;
          this.checklists.set(id, checklist);
          return true;
        },
        saveIfVersion: async (checklist, expected) => {
          const record = checklist.toRecord(),
            id = key(scope, record.occurrenceId),
            current = this.checklists.get(id)?.toRecord();
          if (
            this.rejectChecklistSave ||
            record.congregationId !== scope ||
            current?.version !== expected
          )
            return false;
          if (
            record.version !== expected + 1 ||
            record.templateVersion !== current.templateVersion ||
            record.category !== current.category
          )
            throw new Error('Wrong checklist version/source');
          this.checklists.set(id, checklist);
          return true;
        },
      },
      problems: {
        find: async (congregationId, id) =>
          congregationId === scope
            ? (this.problems.get(key(scope, id)) ?? null)
            : null,
        list: async (congregationId, id) =>
          [...this.problems.values()].filter(
            (p) =>
              congregationId === scope &&
              p.toRecord().congregationId === scope &&
              p.toRecord().occurrenceId === id,
          ),
        insert: async (problem) => {
          const record = problem.toRecord(),
            id = key(scope, record.id);
          if (record.congregationId !== scope || this.problems.has(id))
            throw new Error('Wrong scope/duplicate problem');
          this.problems.set(id, problem);
        },
        saveIfVersion: async (problem, expected) => {
          const record = problem.toRecord(),
            id = key(scope, record.id),
            current = this.problems.get(id)?.toRecord();
          if (
            this.rejectProblemSave ||
            record.congregationId !== scope ||
            current?.version !== expected
          )
            return false;
          if (
            record.version !== expected + 1 ||
            record.occurrenceId !== current.occurrenceId ||
            record.verificationKey !== current.verificationKey ||
            record.description !== current.description
          )
            throw new Error('Wrong problem identity/version');
          this.problems.set(id, problem);
          return true;
        },
      },
      receipts: {
        find: async (congregationId, id) =>
          congregationId === scope
            ? (this.receipts.get(key(scope, id)) ?? null)
            : null,
        insert: async (receipt) => {
          const id = key(scope, receipt.commandId);
          if (receipt.congregationId !== scope || this.receipts.has(id))
            throw new ChecklistError('COMMAND_ID_REUSED');
          this.receipts.set(id, receipt);
          if (this.failReceipts) throw new Error('Receipt storage failed');
        },
      },
      retention: av.retention,
      events: {
        append: async (event) => {
          this.checklistEvents.push(event);
          if (this.failChecklistEvents)
            throw new Error('Checklist event storage failed');
        },
      },
      technicalHistory: {
        find: async (congregationId, id) =>
          congregationId === scope
            ? (this.annual.get(key(scope, id)) ?? null)
            : null,
        record: async (snapshot) => {
          const id = key(scope, snapshot.occurrenceId),
            current = this.annual.get(id);
          if (
            snapshot.congregationId !== scope ||
            (!current && snapshot.version !== 1)
          )
            throw new Error('Missing initial technical history');
          if (current && snapshot.version <= current.sourceVersion) return;
          this.annual.set(id, {
            congregationId: scope,
            occurrenceId: snapshot.occurrenceId,
            category: snapshot.category,
            firstScheduled: current?.firstScheduled ?? snapshot.schedule,
            latestScheduled: snapshot.schedule,
            status: snapshot.status,
            completedAt: current?.completedAt ?? null,
            cancelledAt:
              snapshot.status === 'cancelled'
                ? snapshot.observedAt
                : (current?.cancelledAt ?? null),
            sourceVersion: snapshot.version,
          });
          this.technical.push(snapshot);
          if (this.failAnnual) throw new Error('Annual history failed');
        },
        recordCompletion: async (receipt) => {
          const id = key(scope, receipt.occurrenceId),
            current = this.annual.get(id),
            occurrence = this.occurrences.get(receipt.occurrenceId);
          if (
            receipt.congregationId !== scope ||
            !current ||
            occurrence?.toRecord().status !== 'completed' ||
            occurrence.version !== receipt.sourceVersion
          )
            throw new Error('Unverified completion');
          if (current.status === 'completed') {
            if (
              current.sourceVersion !== receipt.sourceVersion ||
              current.completedAt !== receipt.completedAt
            )
              throw new Error('Conflicting completion');
            return;
          }
          this.annual.set(id, {
            ...current,
            latestScheduled: occurrence.toRecord().schedule,
            status: 'completed',
            completedAt: receipt.completedAt,
            sourceVersion: receipt.sourceVersion,
          });
          this.completionWrites++;
          if (this.failAnnual) throw new Error('Annual history failed');
        },
      },
    };
  }
}
