import type { MaintenanceCategory } from '../maintenance/MaintenanceTypes';
import type { ChecklistTemplate } from './ChecklistTemplate';
import type { MaintenanceChecklist } from './MaintenanceChecklist';
import type { TechnicalProblem } from './TechnicalProblem';
export interface ChecklistTemplateRepository {
  find(
    congregationId: string,
    category: MaintenanceCategory,
  ): Promise<ChecklistTemplate | null>;
  /** Unique congregation/category. False means no writes. */
  insertIfAbsent(template: ChecklistTemplate): Promise<boolean>;
  /** Atomic scoped CAS, immutable identity, version = expected + 1; no writes on false. */
  saveIfVersion(
    template: ChecklistTemplate,
    expected: number,
  ): Promise<boolean>;
}
export interface MaintenanceChecklistRepository {
  find(
    congregationId: string,
    occurrenceId: string,
  ): Promise<MaintenanceChecklist | null>;
  /** Unique congregation/occurrence. Never replace an existing snapshot. */
  insertIfAbsent(checklist: MaintenanceChecklist): Promise<boolean>;
  /** Atomic scoped CAS, immutable source/identity; technicalWorkRecorded is monotonic (never true -> false); version = expected + 1; no writes on false. */
  saveIfVersion(
    checklist: MaintenanceChecklist,
    expected: number,
  ): Promise<boolean>;
}
export interface TechnicalProblemRepository {
  find(
    congregationId: string,
    problemId: string,
  ): Promise<TechnicalProblem | null>;
  list(
    congregationId: string,
    occurrenceId: string,
  ): Promise<readonly TechnicalProblem[]>;
  /** Unique identity, linked to a persisted occurrence/verification in this transaction. */
  insert(problem: TechnicalProblem): Promise<void>;
  /** Atomic scoped CAS; immutable identity, origin and report, version = expected + 1. */
  saveIfVersion(problem: TechnicalProblem, expected: number): Promise<boolean>;
}
