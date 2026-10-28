import { describe, expect, it } from 'vitest';
import {
  loadAudioMaintenanceCatalog,
  toInitialChecklistCatalog,
} from '../../src/infrastructure/catalogs/AudioMaintenanceCatalog';
import { createDemoSource } from '../../src/presentation/demo/createDemoSource';
import {
  categoryLabels,
  detailId,
  formatCivilDate,
  maintenanceHref,
  nextMaintenance,
  problemHref,
  publicTeamPreview,
  roleLabels,
  tabRoutes,
} from '../../src/presentation/demo/presentationModels';

const catalog = () => toInitialChecklistCatalog(loadAudioMaintenanceCatalog());
describe('demonstration presentation source and projections', () => {
  it('declares exactly four distinct bottom tabs with usable list paths', () => {
    expect(tabRoutes.map((t) => t.title)).toEqual([
      'Início',
      'Manutenções',
      'Pendências',
      'Equipe',
    ]);
    expect(new Set(tabRoutes.map((t) => t.href)).size).toBe(4);
    expect(tabRoutes.map((t) => t.href)).toEqual([
      '/',
      '/maintenance',
      '/issues',
      '/team',
    ]);
  });
  it('formats civil dates without shifts caused by the device timezone', () => {
    expect(formatCivilDate('2026-11-07')).toBe('07 de novembro de 2026');
    expect(formatCivilDate('2028-02-29')).toBe('29 de fevereiro de 2028');
  });
  it.each(['2026-02-29', 'invalid', '2026-13-01', '2026-02-30'])(
    'does not display a normalized invalid date %s',
    (date) => {
      expect(formatCivilDate(date)).toBe('Data indisponível');
    },
  );
  it('rejects missing/ambiguous detail IDs and uses route params instead of string concatenation', () => {
    expect(detailId(undefined)).toBeNull();
    expect(detailId(['one', 'two'])).toBeNull();
    expect(detailId(' ')).toBeNull();
    expect(detailId('demo-fortnightly')).toBe('demo-fortnightly');
    expect(maintenanceHref('id/with spaces')).toEqual({
      pathname: '/maintenance/[id]',
      params: { id: 'id/with spaces' },
    });
    expect(problemHref('demo-issue-open')).toEqual({
      pathname: '/issues/[id]',
      params: { id: 'demo-issue-open' },
    });
  });
  it('uses every official pair once, grouped by equipment, without changing the catalog or creating records', async () => {
    const approved = catalog();
    const before = JSON.stringify(approved);
    const source = createDemoSource(approved);
    expect(Object.keys(source)).toEqual(['load']);
    const snapshot = await source.load();
    expect(snapshot.maintenances).toHaveLength(4);
    for (const maintenance of snapshot.maintenances) {
      const template = approved.templates.find(
        (t) => t.category === maintenance.category,
      );
      if (!template) throw new Error('Missing approved model');
      const checks = maintenance.equipment.flatMap((e) =>
        e.checks.map((c) => ({
          equipmentCategoryId: e.id,
          equipmentCategoryName: e.name,
          description: c.description,
          key: c.key,
        })),
      );
      expect(checks).toHaveLength(template.definitions.length);
      for (const entry of template.definitions)
        expect(checks).toContainEqual({
          equipmentCategoryId: entry.equipmentCategoryId,
          equipmentCategoryName: entry.equipmentCategoryName,
          description: entry.taskDescription,
          key: `${entry.taskId}/${entry.equipmentCategoryId}`,
        });
      expect(new Set(maintenance.equipment.map((e) => e.id)).size).toBe(
        maintenance.equipment.length,
      );
    }
    expect(JSON.stringify(approved)).toBe(before);
    expect(Object.isFrozen(snapshot.maintenances)).toBe(true);
  });
  it('does not expose inactive entries, phones, executor identities or assignment lists', async () => {
    const raw = {
      id: 'demo-safe',
      name: 'Nome de exemplo',
      role: 'member' as const,
      status: 'active' as const,
      phone: 'PRIVATE-PHONE',
      metrics: ['PRIVATE-METRIC'],
    };
    expect(publicTeamPreview(raw)).toEqual({
      id: 'demo-safe',
      name: 'Nome de exemplo',
      role: 'member',
    });
    expect(publicTeamPreview({ ...raw, status: 'inactive' })).toBeNull();
    const data = await createDemoSource(catalog()).load();
    expect(JSON.stringify(data)).not.toMatch(
      /"(?:phone|actorId|memberId|assignedMemberIds|responsibleMemberIds|attendance|performedBy)"\s*:/,
    );
    expect(data.team.every((m) => m.name.includes('exemplo'))).toBe(true);
    expect(Object.keys(roleLabels)).toHaveLength(3);
  });
  it('references official equipment and check descriptions for every fictitious issue', async () => {
    const data = await createDemoSource(catalog()).load();
    for (const issue of data.problems) {
      const maintenance = data.maintenances.find(
        (m) => m.id === issue.maintenanceId,
      );
      expect(maintenance?.status).toBe('completed');
      const equipment = maintenance?.equipment.find(
        (e) => e.name === issue.equipmentName,
      );
      expect(
        equipment?.checks.some(
          (check) => check.description === issue.verificationDescription,
        ),
      ).toBe(true);
    }
    expect(new Set(data.problems.map((p) => p.status))).toEqual(
      new Set(['pending', 'resolved']),
    );
    expect(Object.values(categoryLabels)).toEqual([
      'Quinzenal',
      'Mensal',
      'Trimestral',
      'Semestral',
    ]);
  });
  it('selects the next scheduled example without mutating the list; supports an empty list', async () => {
    const data = await createDemoSource(catalog()).load();
    const before = [...data.maintenances];
    expect(nextMaintenance(data.maintenances)?.id).toBe('demo-fortnightly');
    expect(data.maintenances).toEqual(before);
    expect(nextMaintenance([])).toBeUndefined();
    expect(
      nextMaintenance(
        data.maintenances.filter((m) => m.status !== 'scheduled'),
      ),
    ).toBeUndefined();
  });
});
