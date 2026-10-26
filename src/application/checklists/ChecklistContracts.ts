import type { MemberRepository } from '../../domain/members/MemberRepository';
import type { OccurrenceRepository } from '../../domain/maintenance/MaintenanceRepository';
import type {
  ChecklistTemplateRepository,
  MaintenanceChecklistRepository,
  TechnicalProblemRepository,
} from '../../domain/checklists/ChecklistRepositories';
import type { ChecklistSummary } from '../../domain/checklists/MaintenanceChecklist';
import type { AvailabilityRetention } from '../availability/AvailabilityContracts';
import type { AnnualMaintenanceHistory } from '../maintenance/MaintenanceLifecycleContracts';
export interface ChecklistCommandResult {
  readonly templateVersion?: number;
  readonly checklistVersion?: number;
  readonly occurrenceVersion?: number;
  readonly problemId?: string;
  readonly summary?: ChecklistSummary;
}
export interface ChecklistCommandReceipt {
  readonly congregationId: string;
  readonly commandId: string;
  readonly request: string;
  readonly result: ChecklistCommandResult;
}
export interface ChecklistTechnicalEvent {
  readonly id: string;
  readonly congregationId: string;
  readonly occurrenceId: string | null;
  readonly kind:
    | 'template_updated'
    | 'checklist_created'
    | 'occasional_added'
    | 'result_recorded'
    | 'problem_resolved'
    | 'maintenance_completed'
    | 'checklist_corrected';
  readonly version: number;
  readonly occurredAt: string;
}
export interface ChecklistUnitOfWork {
  readonly members: Pick<MemberRepository, 'findById'>;
  readonly occurrences: Pick<
    OccurrenceRepository,
    'findById' | 'saveIfVersion'
  >;
  readonly templates: ChecklistTemplateRepository;
  readonly checklists: MaintenanceChecklistRepository;
  readonly problems: TechnicalProblemRepository;
  /** Unique scope/command, immutable request/result; no actor/executor identity. Same transaction as effects. */
  readonly receipts: {
    find(
      scope: string,
      commandId: string,
    ): Promise<ChecklistCommandReceipt | null>;
    insert(receipt: ChecklistCommandReceipt): Promise<void>;
  };
  readonly technicalHistory: AnnualMaintenanceHistory;
  readonly retention: AvailabilityRetention;
  readonly events: { append(event: ChecklistTechnicalEvent): Promise<void> };
}
export interface ChecklistDependencies {
  /** Shared server serialization with maintenance, availability and members. Roll back EVERY write, receipt, annual fact and retention operation on any failure. */
  readonly transactions: {
    run<T>(
      scope: string,
      work: (tx: ChecklistUnitOfWork) => Promise<T>,
    ): Promise<T>;
  };
  readonly clock: { now(): string };
  readonly ids: { next(): string };
}
