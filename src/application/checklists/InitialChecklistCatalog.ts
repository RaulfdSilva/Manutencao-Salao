import { ChecklistError } from '../../domain/checklists/ChecklistError';
import {
  freezeDefinitions,
  text,
} from '../../domain/checklists/ChecklistTypes';
import type { VerificationDefinition } from '../../domain/checklists/ChecklistTypes';
import {
  assertIdentifier,
  assertVersion,
  maintenanceCategories,
} from '../../domain/maintenance/MaintenanceTypes';
import type { MaintenanceCategory } from '../../domain/maintenance/MaintenanceTypes';

/** Trusted configuration supplied by composition, not client-controlled official provenance. */
export interface InitialChecklistCatalog {
  readonly catalogId: string;
  readonly version: number;
  readonly areaId: 'audio';
  readonly sourceReference: string;
  readonly revisionDate: string;
  readonly templates: readonly {
    readonly category: MaintenanceCategory;
    readonly definitions: readonly VerificationDefinition[];
  }[];
}
export interface CatalogProvisioningResult {
  readonly catalogId: string;
  readonly version: number;
  readonly areaId: 'audio';
  readonly templates: readonly {
    readonly category: MaintenanceCategory;
    readonly disposition: 'created' | 'preserved';
    readonly version: number;
  }[];
}

/** Copy before entering the transaction so mutation cannot change receipt identity or effects. */
export function snapshotInitialCatalog(
  input: InitialChecklistCatalog,
): InitialChecklistCatalog {
  assertIdentifier(input.catalogId);
  assertVersion(input.version);
  if (
    input.areaId !== 'audio' ||
    input.templates.length !== maintenanceCategories.length ||
    new Set(input.templates.map((t) => t.category)).size !==
      maintenanceCategories.length ||
    input.templates.some((t) => !maintenanceCategories.includes(t.category))
  )
    throw new ChecklistError('INVALID_CATALOG');
  return Object.freeze({
    catalogId: input.catalogId,
    version: input.version,
    areaId: input.areaId,
    sourceReference: text(input.sourceReference),
    revisionDate: text(input.revisionDate),
    templates: Object.freeze(
      input.templates.map((template) =>
        Object.freeze({
          category: template.category,
          definitions: freezeDefinitions(template.definitions),
        }),
      ),
    ),
  });
}
