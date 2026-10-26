import { MaintenanceError } from './MaintenanceError';

export const maintenanceCategories = [
  'fortnightly',
  'monthly',
  'quarterly',
  'semiannual',
] as const;
export type MaintenanceCategory = (typeof maintenanceCategories)[number];
export type AvailabilityDecision = 'preserve' | 'reconfirm';
export interface PlanningQuantities {
  readonly minimum: number | null;
  readonly desired: number | null;
}
export interface MaintenanceConfiguration {
  readonly participationMode: 'open' | 'assigned';
  readonly quantities: PlanningQuantities;
  readonly responsibleMemberIds: readonly string[];
}
/** Civil date/time; UTC conversion and DST ambiguity resolution belong to a future adapter. */
export interface MaintenanceSchedule {
  readonly date: string;
  readonly time: string;
  readonly timeZone: string;
}
export type RecurrencePattern =
  | { readonly kind: 'weekends'; readonly day: 'saturday' | 'sunday' }
  | {
      readonly kind: 'months';
      readonly dayOfMonth: number;
      readonly overflow: 'skip' | 'last_day';
    };

export function assertIdentifier(value: string): void {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim())
    throw new MaintenanceError('INVALID_IDENTIFIER');
}
export function assertVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new MaintenanceError('INVALID_VERSION');
}
export function assertCategory(value: MaintenanceCategory): void {
  if (!maintenanceCategories.includes(value))
    throw new MaintenanceError('INVALID_CATEGORY');
}
export function freezeIds(ids: readonly string[]): readonly string[] {
  if (!Array.isArray(ids)) throw new MaintenanceError('INVALID_CONFIGURATION');
  ids.forEach(assertIdentifier);
  if (new Set(ids).size !== ids.length)
    throw new MaintenanceError('INVALID_CONFIGURATION');
  return Object.freeze([...ids].sort());
}
export function freezeConfiguration(
  value: MaintenanceConfiguration,
): MaintenanceConfiguration {
  if (!['open', 'assigned'].includes(value.participationMode))
    throw new MaintenanceError('INVALID_CONFIGURATION');
  const { minimum, desired } = value.quantities;
  for (const count of [minimum, desired]) {
    if (count !== null && (!Number.isSafeInteger(count) || count < 0))
      throw new MaintenanceError('INVALID_QUANTITIES');
  }
  if (minimum !== null && desired !== null && minimum > desired)
    throw new MaintenanceError('INVALID_QUANTITIES');
  return Object.freeze({
    participationMode: value.participationMode,
    quantities: Object.freeze({ minimum, desired }),
    responsibleMemberIds: freezeIds(value.responsibleMemberIds),
  });
}
/** Planning estimate, never a presence or individual performance metric. */
export function assessPlannedParticipation(
  quantities: PlanningQuantities,
  plannedCount: number,
): 'below_minimum' | null {
  if (!Number.isSafeInteger(plannedCount) || plannedCount < 0)
    throw new MaintenanceError('INVALID_QUANTITIES');
  freezeConfiguration({
    participationMode: 'open',
    quantities,
    responsibleMemberIds: [],
  });
  return quantities.minimum !== null && plannedCount < quantities.minimum
    ? 'below_minimum'
    : null;
}
