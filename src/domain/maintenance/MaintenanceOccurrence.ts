import type { Member } from '../members/Member';
import { freezeSchedule, recurrenceCycle } from './Calendar';
import { MaintenanceError } from './MaintenanceError';
import {
  assertCategory,
  assertIdentifier,
  assertVersion,
  assessPlannedParticipation,
  freezeConfiguration,
  freezeIds,
} from './MaintenanceTypes';
import type {
  AvailabilityDecision,
  MaintenanceCategory,
  MaintenanceConfiguration,
  MaintenanceSchedule,
} from './MaintenanceTypes';

export interface OccurrenceSource {
  readonly ruleId: string;
  readonly cycleKey: string;
  readonly ruleVersion: number;
  readonly slotDate: string;
  readonly weekendStart: string | null;
}
export interface OccurrenceRecord {
  readonly id: string;
  readonly congregationId: string;
  readonly category: MaintenanceCategory;
  readonly source: OccurrenceSource | null;
  readonly schedule: MaintenanceSchedule;
  readonly configuration: MaintenanceConfiguration;
  readonly assignedMemberIds: readonly string[];
  readonly status: 'scheduled' | 'cancelled' | 'completed';
  readonly availabilityRevision: number;
  readonly version: number;
}
export type NewOccurrence = Omit<
  OccurrenceRecord,
  'status' | 'version' | 'availabilityRevision'
>;

export class MaintenanceOccurrence {
  private readonly record: OccurrenceRecord;
  private constructor(record: OccurrenceRecord) {
    [record.id, record.congregationId].forEach(assertIdentifier);
    assertCategory(record.category);
    assertVersion(record.version);
    assertVersion(record.availabilityRevision);
    if (!['scheduled', 'cancelled', 'completed'].includes(record.status))
      throw new MaintenanceError('INVALID_STATUS');
    const configuration = freezeConfiguration(record.configuration);
    const assignedMemberIds = freezeIds(record.assignedMemberIds);
    if (configuration.participationMode === 'open' && assignedMemberIds.length)
      throw new MaintenanceError('TEAM_NOT_ALLOWED');
    let source: OccurrenceSource | null = null;
    if (record.source) {
      assertIdentifier(record.source.ruleId);
      assertVersion(record.source.ruleVersion);
      const cycle = recurrenceCycle(
        record.category,
        record.source.slotDate,
        record.source.weekendStart,
      );
      if (record.source.cycleKey !== cycle.cycleKey)
        throw new MaintenanceError('INVALID_CYCLE');
      source = Object.freeze({
        ruleId: record.source.ruleId,
        cycleKey: record.source.cycleKey,
        ruleVersion: record.source.ruleVersion,
        slotDate: record.source.slotDate,
        weekendStart: record.source.weekendStart,
      });
    }
    this.record = Object.freeze({
      id: record.id,
      congregationId: record.congregationId,
      category: record.category,
      source,
      schedule: freezeSchedule(record.schedule),
      configuration,
      assignedMemberIds,
      status: record.status,
      availabilityRevision: record.availabilityRevision,
      version: record.version,
    });
    Object.freeze(this);
  }
  static create(input: NewOccurrence): MaintenanceOccurrence {
    return new MaintenanceOccurrence({
      ...input,
      status: 'scheduled',
      availabilityRevision: 1,
      version: 1,
    });
  }
  static restore(record: OccurrenceRecord): MaintenanceOccurrence {
    return new MaintenanceOccurrence(record);
  }
  get id(): string {
    return this.record.id;
  }
  get congregationId(): string {
    return this.record.congregationId;
  }
  get version(): number {
    return this.record.version;
  }
  toRecord(): OccurrenceRecord {
    return this.record;
  }

  canManageTeam(member: Member): boolean {
    return (
      member.congregationId === this.congregationId &&
      member.status === 'active' &&
      (member.role === 'administrator' ||
        (member.role === 'maintenance_manager' &&
          this.record.configuration.responsibleMemberIds.includes(member.id)))
    );
  }
  canParticipate(member: Member): boolean {
    return (
      member.congregationId === this.congregationId &&
      member.status === 'active' &&
      this.record.status === 'scheduled' &&
      (this.record.configuration.participationMode === 'open' ||
        this.record.assignedMemberIds.includes(member.id) ||
        this.canManageTeam(member))
    );
  }
  planningWarning(): 'below_minimum' | null {
    if (this.record.status !== 'scheduled') return null;
    return this.record.configuration.participationMode === 'assigned'
      ? assessPlannedParticipation(
          this.record.configuration.quantities,
          this.record.assignedMemberIds.length,
        )
      : null;
  }
  reschedule(
    schedule: MaintenanceSchedule,
    decision: AvailabilityDecision,
  ): MaintenanceOccurrence {
    this.assertScheduled();
    if (!['preserve', 'reconfirm'].includes(decision))
      throw new MaintenanceError('INVALID_AVAILABILITY_DECISION');
    const next = freezeSchedule(schedule);
    if (
      JSON.stringify(next) === JSON.stringify(this.record.schedule) &&
      decision === 'preserve'
    )
      return this;
    return this.evolve({
      schedule: next,
      availabilityRevision:
        this.record.availabilityRevision + (decision === 'reconfirm' ? 1 : 0),
    });
  }
  configure(configuration: MaintenanceConfiguration): MaintenanceOccurrence {
    this.assertScheduled();
    const next = freezeConfiguration(configuration);
    const assignedMemberIds =
      next.participationMode === 'open'
        ? Object.freeze([])
        : this.record.assignedMemberIds;
    if (
      JSON.stringify(next) === JSON.stringify(this.record.configuration) &&
      JSON.stringify(assignedMemberIds) ===
        JSON.stringify(this.record.assignedMemberIds)
    )
      return this;
    return this.evolve({ configuration: next, assignedMemberIds });
  }
  assignTeam(ids: readonly string[]): MaintenanceOccurrence {
    this.assertScheduled();
    if (this.record.configuration.participationMode !== 'assigned')
      throw new MaintenanceError('TEAM_NOT_ALLOWED');
    const next = freezeIds(ids);
    if (JSON.stringify(next) === JSON.stringify(this.record.assignedMemberIds))
      return this;
    return this.evolve({ assignedMemberIds: next });
  }
  /** Application must obtain this fact from the shared transactional work history. */
  cancel(technicalWorkRecorded: boolean): MaintenanceOccurrence {
    this.assertScheduled();
    if (technicalWorkRecorded !== false)
      throw new MaintenanceError('TECHNICAL_WORK_RECORDED');
    return this.evolve({ status: 'cancelled' });
  }
  complete(): MaintenanceOccurrence {
    this.assertScheduled();
    return this.evolve({ status: 'completed' });
  }
  private assertScheduled(): void {
    if (this.record.status === 'completed')
      throw new MaintenanceError('OCCURRENCE_COMPLETED');
    if (this.record.status === 'cancelled')
      throw new MaintenanceError('OCCURRENCE_CANCELLED');
  }
  private evolve(
    changes: Partial<
      Pick<
        OccurrenceRecord,
        | 'schedule'
        | 'configuration'
        | 'assignedMemberIds'
        | 'status'
        | 'availabilityRevision'
      >
    >,
  ): MaintenanceOccurrence {
    return new MaintenanceOccurrence({
      ...this.record,
      ...changes,
      version: this.version + 1,
    });
  }
}
