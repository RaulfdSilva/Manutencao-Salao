import { describe, expect, it } from 'vitest';
import data from '../../src/infrastructure/catalogs/audio-maintenance-2026.json';
import {
  loadAudioMaintenanceCatalog,
  parseAudioMaintenanceCatalog,
  toInitialChecklistCatalog,
} from '../../src/infrastructure/catalogs/AudioMaintenanceCatalog';
import { verificationKey } from '../../src/domain/checklists/ChecklistTypes';

// Independent acceptance fixture transcribed from the owner's Implementation 06 request.
const expectedEquipment = [
  ['microphones', 'Microfones'],
  ['cd-dvd-player', 'CD/DVD Player'],
  ['mixing-console', 'Mesa de som'],
  ['equalizers', 'Equalizadores'],
  ['amplifiers', 'Amplificadores'],
  ['loudspeakers', 'Alto-falantes'],
  ['speaker-cabinets', 'Caixas acústicas'],
  ['audio-cables', 'Cabos de áudio'],
  ['power-cables', 'Cabos de força'],
] as const;
const expectedTasks = [
  [
    'Q01',
    'audio-q01',
    'fortnightly',
    'Verificação dos cabos de microfone',
    ['microphones', 'audio-cables'],
  ],
  [
    'Q02',
    'audio-q02',
    'fortnightly',
    'Verificação de pilhas ou baterias',
    ['microphones'],
  ],
  [
    'Q03',
    'audio-q03',
    'fortnightly',
    'Verificação das marcações e ajustes',
    ['mixing-console', 'equalizers', 'amplifiers'],
  ],
  ['M01', 'audio-m01', 'monthly', 'Teste de reprodução', ['cd-dvd-player']],
  [
    'M02',
    'audio-m02',
    'monthly',
    'Verificação das luzes piloto',
    ['cd-dvd-player', 'mixing-console', 'equalizers', 'amplifiers'],
  ],
  [
    'M03',
    'audio-m03',
    'monthly',
    'Limpeza geral',
    [
      'microphones',
      'cd-dvd-player',
      'mixing-console',
      'equalizers',
      'amplifiers',
      'audio-cables',
      'power-cables',
    ],
  ],
  [
    'M04',
    'audio-m04',
    'monthly',
    'Teste das entradas (line, mic, aux, etc.)',
    ['mixing-console', 'equalizers', 'amplifiers'],
  ],
  [
    'T01',
    'audio-t01',
    'quarterly',
    'Verificação do estado do cordão de força',
    ['cd-dvd-player', 'mixing-console', 'equalizers', 'amplifiers'],
  ],
  [
    'T02',
    'audio-t02',
    'quarterly',
    'Inspeção e limpeza dos potenciômetros',
    ['mixing-console', 'equalizers', 'amplifiers'],
  ],
  [
    'T03',
    'audio-t03',
    'quarterly',
    'Verificação dos cabos dos equipamentos',
    ['mixing-console', 'equalizers', 'amplifiers'],
  ],
  [
    'T04',
    'audio-t04',
    'quarterly',
    'Inspeção visual de soldas/conexões',
    ['audio-cables', 'power-cables'],
  ],
  [
    'S01',
    'audio-s01',
    'semiannual',
    'Inspeção visual dos sonofletores',
    ['loudspeakers', 'speaker-cabinets'],
  ],
  [
    'S02',
    'audio-s02',
    'semiannual',
    'Inspeção visual de conexões e cones',
    ['loudspeakers', 'speaker-cabinets'],
  ],
  [
    'S03',
    'audio-s03',
    'semiannual',
    'Teste geral do sistema',
    [
      'microphones',
      'cd-dvd-player',
      'mixing-console',
      'equalizers',
      'amplifiers',
      'loudspeakers',
      'speaker-cabinets',
      'audio-cables',
      'power-cables',
    ],
  ],
  [
    'S04',
    'audio-s04',
    'semiannual',
    'Verificação dos fusíveis reservas',
    ['cd-dvd-player', 'mixing-console', 'equalizers', 'amplifiers'],
  ],
] as const;

describe('official audio working transcription', () => {
  it('contains exactly 15 stable tasks, 9 distinct equipment categories and the 2026 source reference', () => {
    const catalog = loadAudioMaintenanceCatalog();
    expect(catalog.tasks).toHaveLength(15);
    expect(catalog.equipmentCategories).toHaveLength(9);
    expect(catalog.equipmentCategories.map((e) => [e.id, e.name])).toEqual(
      expectedEquipment,
    );
    expect(catalog.id).toBe('audio-maintenance-matrix');
    expect(catalog.areaId).toBe('audio');
    expect(catalog.version).toBe(1);
    expect(catalog.source).toMatchObject({
      revisionDate: '2026-05-30',
      revisionYear: 2026,
      basis: 'owner-provided-transcription',
      originalPhotographVerified: false,
      reference: 'docs/catalogs/audio-maintenance-matrix-2026.md',
    });
    expect(catalog.tasks.map((t) => t.code)).toEqual(
      expectedTasks.map((t) => t[0]),
    );
  });
  it.each(expectedTasks)(
    'preserves %s identity, description, periodicity and ALL and ONLY its equipment associations',
    (code, id, periodicity, description, equipmentCategoryIds) => {
      const task = loadAudioMaintenanceCatalog().tasks.find(
        (t) => t.code === code,
      );
      expect(task).toEqual({
        id,
        code,
        periodicity,
        description,
        equipmentCategoryIds,
      });
    },
  );
  it('expands exactly 50 independent pairs without duplicates or cumulative frequencies', () => {
    const catalog = toInitialChecklistCatalog(loadAudioMaintenanceCatalog());
    expect(
      catalog.templates.map((t) => [t.category, t.definitions.length]),
    ).toEqual([
      ['fortnightly', 6],
      ['monthly', 15],
      ['quarterly', 12],
      ['semiannual', 17],
    ]);
    const pairs = catalog.templates.flatMap((t) =>
      t.definitions.map((d) =>
        verificationKey(d.taskId, d.equipmentCategoryId),
      ),
    );
    expect(pairs).toHaveLength(50);
    expect(new Set(pairs).size).toBe(50);
    const expectedPairs = expectedTasks.flatMap(([, id, , , equipment]) =>
      equipment.map((equipmentId) => verificationKey(id, equipmentId)),
    );
    expect(pairs.sort()).toEqual(expectedPairs.sort());
    const semiannual = catalog.templates.find(
      (t) => t.category === 'semiannual',
    );
    expect(new Set(semiannual?.definitions.map((d) => d.taskId))).toEqual(
      new Set(['audio-s01', 'audio-s02', 'audio-s03', 'audio-s04']),
    );
  });
  it('keeps keys stable when visible descriptions and names change', () => {
    const original = toInitialChecklistCatalog(loadAudioMaintenanceCatalog());
    const edited = structuredClone(data);
    edited.tasks.forEach((t) => {
      t.description = `Descrição revisada: ${t.description}`;
    });
    edited.equipmentCategories.forEach((e) => {
      e.name = `Nome revisado: ${e.name}`;
    });
    const revised = toInitialChecklistCatalog(
      parseAudioMaintenanceCatalog(edited),
    );
    const keys = (catalog: typeof original) =>
      catalog.templates.flatMap((t) =>
        t.definitions.map((d) =>
          verificationKey(d.taskId, d.equipmentCategoryId),
        ),
      );
    expect(keys(revised)).toEqual(keys(original));
  });
  it('returns independent immutable configuration copies without mutating raw JSON', () => {
    const first = loadAudioMaintenanceCatalog(),
      second = loadAudioMaintenanceCatalog();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first.tasks[0]?.equipmentCategoryIds)).toBe(true);
    const initial = toInitialChecklistCatalog(first);
    expect(Object.isFrozen(initial.templates[0]?.definitions[0])).toBe(true);
    expect(Object.isFrozen(initial.templates)).toBe(true);
  });
  it.each([
    [
      'duplicate equipment',
      (raw: typeof data) => {
        const first = raw.equipmentCategories[0];
        if (!first) throw new Error('Missing test equipment');
        raw.equipmentCategories.push({ ...first });
      },
    ],
    [
      'duplicate task',
      (raw: typeof data) => {
        const first = raw.tasks[0];
        if (!first) throw new Error('Missing test task');
        raw.tasks.push({ ...first });
      },
    ],
    [
      'duplicate code',
      (raw: typeof data) => {
        const task = raw.tasks[1];
        if (task) task.code = 'Q01';
      },
    ],
    [
      'duplicate pair',
      (raw: typeof data) =>
        raw.tasks[0]?.equipmentCategoryIds.push('microphones'),
    ],
    [
      'unknown equipment',
      (raw: typeof data) =>
        raw.tasks[0]?.equipmentCategoryIds.push('unknown-equipment'),
    ],
    [
      'missing frequency',
      (raw: typeof data) => {
        raw.tasks = raw.tasks.filter((t) => t.periodicity !== 'monthly');
      },
    ],
    [
      'incorrect year',
      (raw: typeof data) => {
        raw.source.revisionYear = 2025;
      },
    ],
    [
      'invalid date',
      (raw: typeof data) => {
        raw.source.revisionDate = '2026-02-30';
      },
    ],
    [
      'empty description',
      (raw: typeof data) => {
        const task = raw.tasks[0];
        if (task) task.description = ' ';
      },
    ],
  ] as const)(
    'rejects %s before creating domain definitions',
    (_name, mutate) => {
      const invalid = structuredClone(data);
      mutate(invalid);
      expect(() => parseAudioMaintenanceCatalog(invalid)).toThrow();
    },
  );
  it('rejects unsupported schema, area and unexpected actor fields', () => {
    expect(() =>
      parseAudioMaintenanceCatalog({ ...data, schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      parseAudioMaintenanceCatalog({ ...data, areaId: 'video' }),
    ).toThrow();
    expect(() =>
      parseAudioMaintenanceCatalog({ ...data, actorId: 'injected' }),
    ).toThrow();
  });
});
