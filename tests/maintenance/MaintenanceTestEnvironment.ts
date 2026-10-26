import type {
  MaintenanceTechnicalSnapshot,
  AvailabilityReschedule,
} from '../../src/application/maintenance/MaintenanceLifecycleContracts';
import { Member } from '../../src/domain/members/Member';
import type { MemberRecord } from '../../src/domain/members/Member';
import { MaintenanceError } from '../../src/domain/maintenance/MaintenanceError';
import { MaintenanceOccurrence } from '../../src/domain/maintenance/MaintenanceOccurrence';
import { RecurrenceRule } from '../../src/domain/maintenance/RecurrenceRule';
import type {
  MaintenanceConfiguration,
  MaintenanceSchedule,
} from '../../src/domain/maintenance/MaintenanceTypes';
import type { RecurrenceSettings } from '../../src/domain/maintenance/RecurrenceRule';
import type {
  MaintenancePlanningEvent,
  MaintenanceTransactions,
  MaintenanceUnitOfWork,
} from '../../src/application/maintenance/MaintenanceContracts';
import { MaintenanceOperationError } from '../../src/application/maintenance/MaintenanceOperationError';

export const configuration: MaintenanceConfiguration = {
  participationMode: 'assigned',
  quantities: { minimum: 2, desired: 3 },
  responsibleMemberIds: ['manager'],
};
export const schedule: MaintenanceSchedule = {
  date: '2026-11-07',
  time: '09:00',
  timeZone: 'America/Sao_Paulo',
};
export const settings: RecurrenceSettings = {
  category: 'fortnightly',
  startsOn: '2026-01-01',
  endsOn: null,
  time: schedule.time,
  timeZone: schedule.timeZone,
  pattern: { kind: 'weekends', day: 'saturday' },
  defaults: configuration,
};
export const administrator = {
  congregationId: 'congregation',
  memberId: 'admin',
};
export const now = '2026-10-25T01:00:00.000Z';

/** In-memory test adapter only: NOT authentication or evidence of database atomicity. */
export class MaintenanceTestEnvironment implements MaintenanceTransactions {
  members = new Map<string, Member>();
  rules = new Map<string, RecurrenceRule>();
  occurrences = new Map<string, MaintenanceOccurrence>();
  events: MaintenancePlanningEvent[] = [];
  audienceChanges: string[] = [];
  technical: MaintenanceTechnicalSnapshot[] = [];
  reschedules: AvailabilityReschedule[] = [];
  rejectOccurrenceSave = false;
  rejectRuleSave = false;
  failEvents = false;
  private tail: Promise<void> = Promise.resolve();

  seedMember(input: Partial<MemberRecord> & Pick<MemberRecord, 'id'>): Member {
    const member = Member.restore({
      name: 'Pessoa',
      phone: null,
      congregationId: 'congregation',
      role: 'member',
      status: 'active',
      version: 1,
      ...input,
    });
    this.members.set(member.id, member);
    return member;
  }
  seedOccurrence(
    id = 'occurrence',
    changes: Partial<ReturnType<MaintenanceOccurrence['toRecord']>> = {},
  ): MaintenanceOccurrence {
    const occurrence = MaintenanceOccurrence.restore({
      id,
      congregationId: 'congregation',
      category: 'fortnightly',
      source: null,
      schedule,
      configuration,
      assignedMemberIds: [],
      status: 'scheduled',
      availabilityRevision: 1,
      version: 1,
      ...changes,
    });
    this.occurrences.set(occurrence.id, occurrence);
    return occurrence;
  }
  run<T>(
    scope: string,
    work: (tx: MaintenanceUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const result = this.tail.then(async () => {
      const snapshot = {
        audienceChanges: [...this.audienceChanges],
        technical: [...this.technical],
        reschedules: [...this.reschedules],
        rules: new Map(this.rules),
        occurrences: new Map(this.occurrences),
        events: [...this.events],
      };
      const insertOccurrence = (occurrence: MaintenanceOccurrence) => {
        if (this.occurrences.has(occurrence.id))
          throw new MaintenanceOperationError('IDENTIFIER_CONFLICT');
        this.occurrences.set(occurrence.id, occurrence);
      };
      const tx: MaintenanceUnitOfWork = {
        // This planning-only adapter has no checklist or technical problem records.
        technicalWork: { hasRecordedWork: async () => false },
        technicalHistory: {
          record: async (snapshot) => {
            this.technical.push(snapshot);
          },
        },
        lifecycle: {
          availabilityAudienceChanged: async (record) => {
            this.audienceChanges.push(record.id);
          },
          availabilityRescheduled: async (input) => {
            this.reschedules.push(input);
          },
          availabilityCancelled: async () => {},
        },
        members: {
          findById: async (congregationId, id) => {
            const member = this.members.get(id);
            return congregationId === scope && member?.congregationId === scope
              ? member
              : null;
          },
        },
        rules: {
          findById: async (congregationId, id) => {
            const rule = this.rules.get(id);
            return congregationId === scope && rule?.congregationId === scope
              ? rule
              : null;
          },
          insert: async (rule) => {
            if (this.rules.has(rule.id))
              throw new MaintenanceOperationError('IDENTIFIER_CONFLICT');
            this.rules.set(rule.id, rule);
          },
          saveIfVersion: async (rule, expectedVersion) => {
            const current = this.rules.get(rule.id);
            if (
              this.rejectRuleSave ||
              rule.congregationId !== scope ||
              current?.congregationId !== scope ||
              current.version !== expectedVersion
            )
              return false;
            if (rule.version !== expectedVersion + 1)
              throw new MaintenanceError('INVALID_VERSION');
            if (
              JSON.stringify(rule.toRecord().revisions.slice(0, -1)) !==
              JSON.stringify(current.toRecord().revisions)
            )
              throw new MaintenanceError('INVALID_RECURRENCE');
            this.rules.set(rule.id, rule);
            return true;
          },
        },
        occurrences: {
          findById: async (congregationId, id) => {
            const occurrence = this.occurrences.get(id);
            return congregationId === scope &&
              occurrence?.congregationId === scope
              ? occurrence
              : null;
          },
          list: async (congregationId, range) =>
            [...this.occurrences.values()].filter((occurrence) => {
              const record = occurrence.toRecord();
              return (
                congregationId === scope &&
                record.congregationId === scope &&
                record.schedule.date >= range.from &&
                record.schedule.date <= range.to
              );
            }),
          insert: async (occurrence) => {
            if (occurrence.toRecord().source !== null)
              throw new MaintenanceError('INVALID_CONFIGURATION');
            insertOccurrence(occurrence);
          },
          insertGeneratedIfAbsent: async (occurrence) => {
            const source = occurrence.toRecord().source;
            if (!source || occurrence.congregationId !== scope)
              throw new MaintenanceError('INVALID_CONFIGURATION');
            const existing = [...this.occurrences.values()].find((item) => {
              const record = item.toRecord();
              return (
                record.congregationId === scope &&
                record.source?.ruleId === source.ruleId &&
                record.source.cycleKey === source.cycleKey
              );
            });
            if (existing) return { inserted: false, occurrence: existing };
            insertOccurrence(occurrence);
            return { inserted: true, occurrence };
          },
          saveIfVersion: async (occurrence, expectedVersion) => {
            const current = this.occurrences.get(occurrence.id);
            if (
              this.rejectOccurrenceSave ||
              occurrence.congregationId !== scope ||
              current?.congregationId !== scope ||
              current.version !== expectedVersion
            )
              return false;
            if (occurrence.version !== expectedVersion + 1)
              throw new MaintenanceError('INVALID_VERSION');
            if (
              JSON.stringify(occurrence.toRecord().source) !==
              JSON.stringify(current.toRecord().source)
            )
              throw new MaintenanceError('INVALID_CYCLE');
            this.occurrences.set(occurrence.id, occurrence);
            return true;
          },
        },
        events: {
          append: async (event) => {
            this.events.push(event);
            if (this.failEvents) throw new Error('Event storage unavailable');
          },
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        this.audienceChanges = snapshot.audienceChanges;
        this.technical = snapshot.technical;
        this.reschedules = snapshot.reschedules;
        this.rules = snapshot.rules;
        this.occurrences = snapshot.occurrences;
        this.events = snapshot.events;
        throw error;
      }
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
