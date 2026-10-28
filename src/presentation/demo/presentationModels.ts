import type { MaintenanceCategory } from '../../domain/maintenance/MaintenanceTypes';
import type { MemberRole } from '../../domain/members/Member';
import type { MaintenancePreview, TeamPreview } from './PresentationSource';

export const tabRoutes = [
  { name: 'index', href: '/', title: 'Início', icon: 'home' },
  {
    name: 'maintenance',
    href: '/maintenance',
    title: 'Manutenções',
    icon: 'calendar',
  },
  { name: 'issues', href: '/issues', title: 'Pendências', icon: 'issue' },
  { name: 'team', href: '/team', title: 'Equipe', icon: 'team' },
] as const;
export const categoryLabels: Record<MaintenanceCategory, string> = {
  fortnightly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
};
export const roleLabels: Record<MemberRole, string> = {
  administrator: 'Administrador',
  maintenance_manager: 'Responsável pela manutenção',
  member: 'Membro',
};
export function formatCivilDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}
export function dateTile(date: string) {
  if (formatCivilDate(date) === 'Data indisponível')
    return { day: '—', month: 'DATA' };
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return {
    day: date.slice(8, 10),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
      .format(parsed)
      .replace('.', '')
      .toUpperCase(),
  };
}
export function nextMaintenance(items: readonly MaintenancePreview[]) {
  return [...items]
    .filter((item) => item.status === 'scheduled')
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    )[0];
}
export function maintenanceHref(id: string) {
  return { pathname: '/maintenance/[id]' as const, params: { id } };
}
export function problemHref(id: string) {
  return { pathname: '/issues/[id]' as const, params: { id } };
}
export function detailId(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    ? value
    : null;
}
/** Whitelist preview fields; no telephone or inactive entries reach the component. */
export function publicTeamPreview(input: {
  readonly id: string;
  readonly name: string;
  readonly role: MemberRole;
  readonly status: 'active' | 'inactive';
}): TeamPreview | null {
  return input.status === 'active'
    ? Object.freeze({ id: input.id, name: input.name, role: input.role })
    : null;
}
