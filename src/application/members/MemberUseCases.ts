import { Member } from '../../domain/members/Member';
import type { MemberProfile, MemberRole } from '../../domain/members/Member';
import type {
  MemberActor,
  MemberAuditAction,
  MemberDependencies,
  MemberUnitOfWork,
  MemberView,
} from './MemberContracts';
import { MemberOperationError } from './MemberOperationError';

async function requireActor(
  tx: MemberUnitOfWork,
  actor: MemberActor,
): Promise<Member> {
  const member = await tx.members.findById(
    actor.congregationId,
    actor.memberId,
  );
  if (!member || member.status !== 'active')
    throw new MemberOperationError('FORBIDDEN');
  return member;
}

function requireAdministrator(actor: Member): void {
  if (!actor.isActiveAdministrator) throw new MemberOperationError('FORBIDDEN');
}

async function requireMember(
  tx: MemberUnitOfWork,
  congregationId: string,
  id: string,
): Promise<Member> {
  const member = await tx.members.findById(congregationId, id);
  if (!member) throw new MemberOperationError('MEMBER_NOT_FOUND');
  return member;
}

function projectMember(member: Member, actor: Member): MemberView {
  const view = {
    id: member.id,
    congregationId: member.congregationId,
    name: member.name,
    role: member.role,
    status: member.status,
  };
  return actor.isActiveAdministrator ? { ...view, phone: member.phone } : view;
}

/** Application orchestration only. No authentication or persistence adapter is provided. */
export class MemberUseCases {
  constructor(private readonly dependencies: MemberDependencies) {}

  create(
    actor: MemberActor,
    input: MemberProfile & { readonly role: MemberRole },
  ): Promise<MemberView> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const requester = await requireActor(tx, actor);
        requireAdministrator(requester);
        const member = Member.create({
          id: this.dependencies.ids.next(),
          congregationId: actor.congregationId,
          name: input.name,
          phone: input.phone ?? null,
          role: input.role,
        });
        await tx.members.insert(member);
        await this.recordAudit(tx, actor, 'created', null, member);
        return projectMember(member, requester);
      },
    );
  }

  get(actor: MemberActor, memberId: string): Promise<MemberView> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const requester = await requireActor(tx, actor);
        if (!requester.isActiveAdministrator && requester.id !== memberId) {
          throw new MemberOperationError('FORBIDDEN');
        }
        return projectMember(
          await requireMember(tx, actor.congregationId, memberId),
          requester,
        );
      },
    );
  }

  list(actor: MemberActor): Promise<readonly MemberView[]> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const requester = await requireActor(tx, actor);
        requireAdministrator(requester);
        return (await tx.members.list(actor.congregationId)).map((member) =>
          projectMember(member, requester),
        );
      },
    );
  }

  update(
    actor: MemberActor,
    memberId: string,
    input: MemberProfile,
  ): Promise<MemberView> {
    return this.change(actor, memberId, 'profile_updated', (member) =>
      member.editProfile(input),
    );
  }

  changeRole(
    actor: MemberActor,
    memberId: string,
    role: MemberRole,
  ): Promise<MemberView> {
    return this.change(actor, memberId, 'role_changed', (member) =>
      member.changeRole(role),
    );
  }

  deactivate(actor: MemberActor, memberId: string): Promise<MemberView> {
    return this.change(actor, memberId, 'deactivated', (member) =>
      member.deactivate(),
    );
  }

  reactivate(actor: MemberActor, memberId: string): Promise<MemberView> {
    return this.change(actor, memberId, 'reactivated', (member) =>
      member.reactivate(),
    );
  }

  private change(
    actor: MemberActor,
    memberId: string,
    action: Exclude<MemberAuditAction, 'created'>,
    transform: (member: Member) => Member,
  ): Promise<MemberView> {
    return this.dependencies.transactions.run(
      actor.congregationId,
      async (tx) => {
        const requester = await requireActor(tx, actor);
        requireAdministrator(requester);
        const before = await requireMember(tx, actor.congregationId, memberId);
        const after = transform(before);
        if (
          before.isActiveAdministrator &&
          !after.isActiveAdministrator &&
          (await tx.members.countActiveAdministrators(actor.congregationId)) <=
            1
        ) {
          throw new MemberOperationError('LAST_ACTIVE_ADMINISTRATOR');
        }
        if (
          before.name === after.name &&
          before.phone === after.phone &&
          before.role === after.role &&
          before.status === after.status
        ) {
          return projectMember(before, requester);
        }
        const occurredAt = this.dependencies.clock.now();
        await tx.members.save(after);
        if (before.status === 'active' && after.status === 'inactive') {
          await tx.futureAssignments.releaseForMember({
            congregationId: actor.congregationId,
            memberId,
            actorId: actor.memberId,
            effectiveAt: occurredAt,
          });
        }
        await this.recordAudit(tx, actor, action, before, after, occurredAt);
        // Re-evaluate phone visibility after self-demotion or self-deactivation.
        return projectMember(
          after,
          after.id === requester.id ? after : requester,
        );
      },
    );
  }

  private recordAudit(
    tx: MemberUnitOfWork,
    actor: MemberActor,
    action: MemberAuditAction,
    before: Member | null,
    after: Member,
    occurredAt = this.dependencies.clock.now(),
  ): Promise<void> {
    return tx.audit.append({
      actorId: actor.memberId,
      congregationId: actor.congregationId,
      memberId: after.id,
      action,
      occurredAt,
      before: before ? { role: before.role, status: before.status } : null,
      after: { role: after.role, status: after.status },
    });
  }
}
