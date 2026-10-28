import { describe, expect, it } from 'vitest';
import { createPublicDemoSource } from '../../src/composition/publicDemo';

describe('public preview boundary', () => {
  it('uses exclusively the existing fictitious DTOs through a read-only source', async () => {
    const source = createPublicDemoSource();
    expect(Object.keys(source)).toEqual(['load']);
    const snapshot = await source.load();
    expect(Object.keys(snapshot).sort()).toEqual([
      'maintenances',
      'problems',
      'team',
    ]);
    expect(snapshot.maintenances.map((item) => item.id)).toEqual([
      'demo-fortnightly',
      'demo-monthly',
      'demo-quarterly',
      'demo-semiannual',
    ]);
    expect(snapshot.problems.map((item) => item.id)).toEqual([
      'demo-issue-open',
      'demo-issue-resolved',
    ]);
    expect(snapshot.team.map((item) => item.name)).toEqual([
      'Administrador de exemplo',
      'Responsável de exemplo',
      'Membro de exemplo',
    ]);
    for (const member of snapshot.team)
      expect(Object.keys(member).sort()).toEqual(['id', 'name', 'role']);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"(?:phone|token|password|actorId|assignedMemberIds|responsibleMemberIds|performedBy)"\s*:/,
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });
});
