import { Member } from '../../src/domain/members/Member';
import type { MemberRecord } from '../../src/domain/members/Member';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import type { OccurrenceRecord } from '../../src/domain/maintenance/MaintenanceOccurrence';
import { AvailabilityPlan } from '../../src/domain/availability/AvailabilityPlan';
import type { AvailabilityRecord } from '../../src/domain/availability/AvailabilityPlan';
import type {
  AvailabilityDeadline,
  AvailabilityEvent,
  AvailabilityUnitOfWork,
  AvailabilityDependencies,
} from '../../src/application/availability/AvailabilityContracts';
import { AvailabilityError } from '../../src/domain/availability/AvailabilityError';

export const admin = { congregationId: 'congregation', memberId: 'admin' };
export const manager = { ...admin, memberId: 'manager' };
export const member = { ...admin, memberId: 'member' };
export const deadline = '2026-11-01T12:00:00.000Z';
export const later = '2026-11-02T12:00:00.000Z';
function key(scope: string, id: string, revision: number): string {
  return JSON.stringify([scope, id, revision]);
}
/** Only a contract test adapter; never used by the application or as proof of real server transactions. */
export class AvailabilityTestEnvironment implements AvailabilityDependencies {
  now = '2026-10-26T12:00:00.000Z';
  clock = { now: () => this.now };
  members = new Map<string, Member>();
  occurrences = new Map<string, MaintenanceOccurrence>();
  plans = new Map<string, AvailabilityPlan>();
  events: AvailabilityEvent[] = [];
  jobs: AvailabilityDeadline[] = [];
  failEvents = false;
  failJobs = false;
  refuseSave = false;
  refuseInsert = false;
  private tail: Promise<void> = Promise.resolve();
  transactions = {
    run: <T>(scope: string, work: (tx: AvailabilityUnitOfWork) => Promise<T>) =>
      this.run(scope, work),
  };
  constructor() {
    this.seedMember({ id: 'admin', role: 'administrator' });
    this.seedMember({ id: 'manager', role: 'maintenance_manager' });
    this.seedMember({ id: 'member' });
    this.seedMember({ id: 'other' });
    this.seedMember({ id: 'inactive', status: 'inactive' });
    this.seedMember({ id: 'foreign', congregationId: 'foreign' });
    this.seedOccurrence();
  }
  seedMember(input: Partial<MemberRecord> & Pick<MemberRecord, 'id'>): Member {
    const entity = Member.restore({
      name: 'Pessoa',
      phone: null,
      role: 'member',
      status: 'active',
      version: 1,
      congregationId: 'congregation',
      ...input,
    });
    this.members.set(entity.id, entity);
    return entity;
  }
  seedOccurrence(input: Partial<OccurrenceRecord> = {}): MaintenanceOccurrence {
    const entity = MaintenanceOccurrence.restore({
      id: 'occurrence',
      congregationId: 'congregation',
      category: 'fortnightly',
      schedule: {
        date: '2026-11-07',
        time: '09:00',
        timeZone: 'America/Sao_Paulo',
      },
      configuration: {
        participationMode: 'open',
        responsibleMemberIds: ['manager'],
        quantities: { minimum: 2, desired: 3 },
      },
      assignedMemberIds: [],
      source: null,
      status: 'scheduled',
      availabilityRevision: 1,
      version: 1,
      ...input,
    });
    this.occurrences.set(entity.id, entity);
    return entity;
  }
  plan(
    revision = 1,
    scope = 'congregation',
    id = 'occurrence',
  ): AvailabilityPlan {
    const plan = this.plans.get(key(scope, id, revision));
    if (!plan) throw new Error('Missing test plan');
    return plan;
  }
  replaceOccurrence(entity: MaintenanceOccurrence): void {
    this.occurrences.set(entity.id, entity);
  }
  run<T>(
    scope: string,
    work: (tx: AvailabilityUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const result = this.tail.then(async () => {
      const snapshot = {
        members: new Map(this.members),
        occurrences: new Map(this.occurrences),
        plans: new Map(this.plans),
        events: [...this.events],
        jobs: [...this.jobs],
      };
      const tx: AvailabilityUnitOfWork = {
        members: {
          findById: async (congregationId, id) => {
            const entity = this.members.get(id);
            return congregationId === scope && entity?.congregationId === scope
              ? entity
              : null;
          },
          list: async (congregationId) =>
            [...this.members.values()].filter(
              (m) => congregationId === scope && m.congregationId === scope,
            ),
        },
        occurrences: {
          findById: async (congregationId, id) => {
            const entity = this.occurrences.get(id);
            return congregationId === scope && entity?.congregationId === scope
              ? entity
              : null;
          },
        },
        availability: {
          find: async (congregationId, id, revision) =>
            congregationId === scope
              ? (this.plans.get(key(scope, id, revision)) ?? null)
              : null,
          insertIfAbsent: async (plan) => {
            const record = plan.toRecord(),
              id = key(
                record.congregationId,
                record.occurrenceId,
                record.revision,
              );
            if (record.congregationId !== scope || record.version !== 1)
              throw new Error('Invalid scoped insert');
            if (this.refuseInsert || this.plans.has(id)) return false;
            this.plans.set(id, plan);
            return true;
          },
          saveIfVersion: async (plan, expected) => {
            const record = plan.toRecord(),
              id = key(
                record.congregationId,
                record.occurrenceId,
                record.revision,
              ),
              current = this.plans.get(id);
            if (
              this.refuseSave ||
              record.congregationId !== scope ||
              current?.toRecord().version !== expected
            )
              return false;
            if (record.version !== expected + 1)
              throw new AvailabilityError('INVALID_VERSION');
            this.plans.set(id, plan);
            return true;
          },
        },
        events: {
          append: async (event) => {
            this.events.push(event);
            if (this.failEvents) throw new Error('Event storage failed');
          },
        },
        deadlines: {
          schedule: async (job) => {
            this.jobs.push(job);
            if (this.failJobs) throw new Error('Job storage failed');
          },
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        this.members = snapshot.members;
        this.occurrences = snapshot.occurrences;
        this.plans = snapshot.plans;
        this.events = snapshot.events;
        this.jobs = snapshot.jobs;
        throw error;
      }
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  seedPlan(record: AvailabilityRecord): void {
    this.plans.set(
      key(record.congregationId, record.occurrenceId, record.revision),
      AvailabilityPlan.restore(record),
    );
  }
}
