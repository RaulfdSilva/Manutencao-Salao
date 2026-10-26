import {
  assertCategory,
  assertIdentifier,
  assertVersion,
} from '../maintenance/MaintenanceTypes';
import type { MaintenanceCategory } from '../maintenance/MaintenanceTypes';
import { freezeDefinitions } from './ChecklistTypes';
import type { VerificationDefinition } from './ChecklistTypes';
export interface ChecklistTemplateRecord {
  readonly congregationId: string;
  readonly category: MaintenanceCategory;
  readonly version: number;
  readonly definitions: readonly VerificationDefinition[];
}
export class ChecklistTemplate {
  private readonly record: ChecklistTemplateRecord;
  private constructor(record: ChecklistTemplateRecord) {
    assertIdentifier(record.congregationId);
    assertCategory(record.category);
    assertVersion(record.version);
    this.record = Object.freeze({
      congregationId: record.congregationId,
      category: record.category,
      version: record.version,
      definitions: freezeDefinitions(record.definitions),
    });
    Object.freeze(this);
  }
  static create(
    input: Omit<ChecklistTemplateRecord, 'version'>,
  ): ChecklistTemplate {
    return new ChecklistTemplate({ ...input, version: 1 });
  }
  static restore(record: ChecklistTemplateRecord): ChecklistTemplate {
    return new ChecklistTemplate(record);
  }
  toRecord(): ChecklistTemplateRecord {
    return this.record;
  }
  revise(definitions: readonly VerificationDefinition[]): ChecklistTemplate {
    const next = freezeDefinitions(definitions);
    return JSON.stringify(next) === JSON.stringify(this.record.definitions)
      ? this
      : new ChecklistTemplate({
          ...this.record,
          version: this.record.version + 1,
          definitions: next,
        });
  }
}
