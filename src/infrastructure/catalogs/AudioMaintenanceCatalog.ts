import { z } from 'zod';
import data from './audio-maintenance-2026.json';
import { maintenanceCategories } from '../../domain/maintenance/MaintenanceTypes';
import { snapshotInitialCatalog } from '../../application/checklists/InitialChecklistCatalog';
import type { InitialChecklistCatalog } from '../../application/checklists/InitialChecklistCatalog';

const identifier = z.string().regex(/^[a-z][a-z0-9-]*$/);
const nonempty = z.string().trim().min(1);
const catalogSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: identifier,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    areaId: z.literal('audio'),
    source: z.strictObject({
      title: nonempty,
      revisionDate: z.iso.date(),
      revisionYear: z.number().int().min(1).max(9999),
      basis: z.literal('owner-provided-transcription'),
      originalPhotographVerified: z.boolean(),
      reference: nonempty,
    }),
    equipmentCategories: z
      .array(z.strictObject({ id: identifier, name: nonempty }))
      .min(1),
    tasks: z
      .array(
        z.strictObject({
          id: identifier,
          code: z.string().regex(/^[QMTS][0-9]{2}$/),
          periodicity: z.enum(maintenanceCategories),
          description: nonempty,
          equipmentCategoryIds: z.array(identifier).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((catalog, context) => {
    const unique = (values: readonly string[], path: string) => {
      if (new Set(values).size !== values.length)
        context.addIssue({
          code: 'custom',
          path: [path],
          message: 'Duplicate catalog identifier or association',
        });
    };
    unique(
      catalog.equipmentCategories.map((e) => e.id),
      'equipmentCategories',
    );
    unique(
      catalog.tasks.map((t) => t.id),
      'tasks',
    );
    unique(
      catalog.tasks.map((t) => t.code),
      'tasks',
    );
    const ids = new Set(catalog.equipmentCategories.map((e) => e.id));
    for (const [index, task] of catalog.tasks.entries()) {
      unique(task.equipmentCategoryIds, `tasks.${index}.equipmentCategoryIds`);
      for (const id of task.equipmentCategoryIds)
        if (!ids.has(id))
          context.addIssue({
            code: 'custom',
            path: ['tasks', index],
            message: 'Unknown equipment category',
          });
    }
    for (const periodicity of maintenanceCategories)
      if (!catalog.tasks.some((t) => t.periodicity === periodicity))
        context.addIssue({
          code: 'custom',
          path: ['tasks'],
          message: 'Missing maintenance periodicity',
        });
    if (
      Number(catalog.source.revisionDate.slice(0, 4)) !==
      catalog.source.revisionYear
    )
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Inconsistent revision year',
      });
  });

/** Pure validation/loading only. No storage, initialization or application calls on import. */
export function parseAudioMaintenanceCatalog(input: unknown) {
  const parsed = catalogSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze(parsed.source),
    equipmentCategories: Object.freeze(
      parsed.equipmentCategories.map((e) => Object.freeze(e)),
    ),
    tasks: Object.freeze(
      parsed.tasks.map((t) =>
        Object.freeze({
          ...t,
          equipmentCategoryIds: Object.freeze(t.equipmentCategoryIds),
        }),
      ),
    ),
  });
}
export function loadAudioMaintenanceCatalog() {
  return parseAudioMaintenanceCatalog(data);
}
export function toInitialChecklistCatalog(
  catalog: ReturnType<typeof parseAudioMaintenanceCatalog>,
): InitialChecklistCatalog {
  // Revalidate even callers not using the loader; a type alone is not validation.
  const validated = parseAudioMaintenanceCatalog(catalog);
  const equipment = new Map(
    validated.equipmentCategories.map((e) => [e.id, e]),
  );
  return snapshotInitialCatalog({
    catalogId: validated.id,
    version: validated.version,
    areaId: validated.areaId,
    sourceReference: validated.source.reference,
    revisionDate: validated.source.revisionDate,
    templates: maintenanceCategories.map((category) => ({
      category,
      definitions: validated.tasks
        .filter((t) => t.periodicity === category)
        .flatMap((task) =>
          task.equipmentCategoryIds.map((id) => {
            const target = equipment.get(id);
            if (!target)
              throw new Error('Validated equipment category is missing');
            return {
              taskId: task.id,
              taskDescription: task.description,
              equipmentCategoryId: target.id,
              equipmentCategoryName: target.name,
            };
          }),
        ),
    })),
  });
}
