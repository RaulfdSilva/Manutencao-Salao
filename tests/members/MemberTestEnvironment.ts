import { Member } from '../../src/domain/members/Member';
import type { MemberRecord } from '../../src/domain/members/Member';
import type {
  FutureAssignments,
  MemberAuditEvent,
  MemberTransactions,
  MemberUnitOfWork,
} from '../../src/application/members/MemberContracts';
import { MemberOperationError } from '../../src/application/members/MemberOperationError';

/** Test double only: does not authenticate users or prove database atomicity. */
export class MemberTestEnvironment implements MemberTransactions {
  records = new Map<string, Member>();
  events: MemberAuditEvent[] = [];
  releases: Parameters<FutureAssignments['releaseForMember']>[0][] = [];
  failure: 'save' | 'release' | 'audit' | null = null;
  private tail: Promise<void> = Promise.resolve();

  seed(input: Partial<MemberRecord> & Pick<MemberRecord, 'id'>): Member {
    const member = Member.restore({
      congregationId: 'congregation-1',
      name: 'Ana Silva',
      phone: '+5511999990000',
      role: 'member',
      status: 'active',
      ...input,
    });
    this.records.set(member.id, member);
    return member;
  }

  run<T>(
    congregationId: string,
    work: (tx: MemberUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const result = this.tail.then(async () => {
      const snapshot = {
        records: new Map(this.records),
        events: [...this.events],
        releases: [...this.releases],
      };
      const tx: MemberUnitOfWork = {
        members: {
          findById: async (scope, id) => {
            const member = this.records.get(id);
            return scope === congregationId && member?.congregationId === scope
              ? member
              : null;
          },
          list: async (scope) =>
            [...this.records.values()].filter(
              (m) => m.congregationId === scope && scope === congregationId,
            ),
          countActiveAdministrators: async (scope) =>
            [...this.records.values()].filter(
              (m) => m.congregationId === scope && m.isActiveAdministrator,
            ).length,
          insert: async (member) => {
            if (this.records.has(member.id))
              throw new MemberOperationError('MEMBER_ALREADY_EXISTS');
            this.records.set(member.id, member);
          },
          save: async (member) => {
            if (this.failure === 'save') throw new Error('Storage unavailable');
            if (!this.records.has(member.id))
              throw new MemberOperationError('MEMBER_NOT_FOUND');
            this.records.set(member.id, member);
          },
        },
        futureAssignments: {
          releaseForMember: async (input) => {
            if (this.failure === 'release')
              throw new Error('Assignments unavailable');
            this.releases.push(input);
          },
        },
        audit: {
          append: async (event) => {
            if (this.failure === 'audit') throw new Error('Audit unavailable');
            this.events.push(event);
          },
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        this.records = snapshot.records;
        this.events = snapshot.events;
        this.releases = snapshot.releases;
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
