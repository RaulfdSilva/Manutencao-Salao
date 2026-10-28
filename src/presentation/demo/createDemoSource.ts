import type { InitialChecklistCatalog } from '../../application/checklists/InitialChecklistCatalog';
import { verificationKey } from '../../domain/checklists/ChecklistTypes';
import type {
  MaintenancePreview,
  PresentationSnapshot,
  PresentationSource,
} from './PresentationSource';
import { publicTeamPreview } from './presentationModels';

/** Fictitious read-only examples, isolated from all domain repositories and use cases. */
export function createDemoSource(
  catalog: InitialChecklistCatalog,
): PresentationSource {
  const examples = [
    {
      id: 'demo-fortnightly',
      title: 'Cuidado periódico do áudio',
      category: 'fortnightly',
      date: '2026-11-07',
      time: '09:00',
      status: 'scheduled',
    },
    {
      id: 'demo-monthly',
      title: 'Revisão mensal do sistema',
      category: 'monthly',
      date: '2026-11-14',
      time: '09:00',
      status: 'scheduled',
    },
    {
      id: 'demo-quarterly',
      title: 'Inspeção trimestral de áudio',
      category: 'quarterly',
      date: '2026-10-17',
      time: '09:00',
      status: 'completed',
    },
    {
      id: 'demo-semiannual',
      title: 'Revisão semestral do sistema',
      category: 'semiannual',
      date: '2026-10-03',
      time: '09:00',
      status: 'cancelled',
    },
  ] as const;
  const maintenances: MaintenancePreview[] = examples.map((item) => {
    const template = catalog.templates.find(
      (t) => t.category === item.category,
    );
    if (!template) throw new Error('Catálogo incompleto para a demonstração');
    const equipment = new Map<
      string,
      MaintenancePreview['equipment'][number]
    >();
    for (const definition of template.definitions) {
      const previous = equipment.get(definition.equipmentCategoryId);
      const check = Object.freeze({
        key: verificationKey(definition.taskId, definition.equipmentCategoryId),
        description: definition.taskDescription,
        status:
          item.status === 'completed'
            ? definition.taskId === 'audio-t01' &&
              definition.equipmentCategoryId === 'cd-dvd-player'
              ? ('problem_found' as const)
              : ('completed' as const)
            : ('unfilled' as const),
      });
      equipment.set(
        definition.equipmentCategoryId,
        Object.freeze({
          id: definition.equipmentCategoryId,
          name: definition.equipmentCategoryName,
          checks: Object.freeze([...(previous?.checks ?? []), check]),
        }),
      );
    }
    return Object.freeze({
      ...item,
      timeZone: 'America/Sao_Paulo',
      equipment: Object.freeze([...equipment.values()]),
    });
  });
  const completed = maintenances.find((item) => item.id === 'demo-quarterly');
  const problemEquipment = completed?.equipment.find(
    (item) => item.id === 'cd-dvd-player',
  );
  const resolvedEquipment = completed?.equipment.find(
    (item) => item.id === 'mixing-console',
  );
  const problemCheck = problemEquipment?.checks.find(
    (item) => item.key === verificationKey('audio-t01', 'cd-dvd-player'),
  );
  const resolvedCheck = resolvedEquipment?.checks.find(
    (item) => item.key === verificationKey('audio-t03', 'mixing-console'),
  );
  if (
    !problemCheck ||
    !resolvedCheck ||
    !problemEquipment ||
    !resolvedEquipment
  )
    throw new Error('Verificações oficiais ausentes na demonstração');
  // These are illustrative observations, not maintenance instructions or persisted records.
  const problems = Object.freeze([
    Object.freeze({
      id: 'demo-issue-open',
      maintenanceId: 'demo-quarterly',
      description: 'Desgaste aparente no cordão de força (exemplo fictício).',
      equipmentName: problemEquipment.name,
      verificationDescription: problemCheck.description,
      status: 'pending' as const,
      recordedOn: '2026-10-17',
    }),
    Object.freeze({
      id: 'demo-issue-resolved',
      maintenanceId: 'demo-quarterly',
      description:
        'Conexão com folga relatada no exemplo. Registro ilustrativo já concluído.',
      equipmentName: resolvedEquipment.name,
      verificationDescription: resolvedCheck.description,
      status: 'resolved' as const,
      recordedOn: '2026-10-17',
    }),
  ]);
  const team = [
    publicTeamPreview({
      id: 'demo-admin',
      name: 'Administrador de exemplo',
      role: 'administrator',
      status: 'active',
    }),
    publicTeamPreview({
      id: 'demo-manager',
      name: 'Responsável de exemplo',
      role: 'maintenance_manager',
      status: 'active',
    }),
    publicTeamPreview({
      id: 'demo-member',
      name: 'Membro de exemplo',
      role: 'member',
      status: 'active',
    }),
  ].filter((item) => item !== null);
  const snapshot: PresentationSnapshot = Object.freeze({
    maintenances: Object.freeze(maintenances),
    problems,
    team: Object.freeze(team),
  });
  return Object.freeze({ load: async () => snapshot });
}
