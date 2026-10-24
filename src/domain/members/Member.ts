import { MemberError } from './MemberError';

export type MemberRole = 'administrator' | 'maintenance_manager' | 'member';
export type MemberStatus = 'active' | 'inactive';

export interface MemberRecord {
  readonly id: string;
  readonly congregationId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly role: MemberRole;
  readonly status: MemberStatus;
}

export interface MemberProfile {
  readonly name: string;
  readonly phone?: string | null;
}

export interface NewMember extends MemberProfile {
  readonly id: string;
  readonly congregationId: string;
  readonly role: MemberRole;
}

function validateIdentifier(value: string): void {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new MemberError('INVALID_IDENTIFIER');
  }
}

function normalizeName(value: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MemberError('INVALID_NAME');
  }
  return value.trim();
}

function normalizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new MemberError('INVALID_PHONE');
  return value.trim() || null;
}

export class Member {
  private readonly record: Readonly<MemberRecord>;

  private constructor(record: MemberRecord) {
    validateIdentifier(record.id);
    validateIdentifier(record.congregationId);
    if (
      !['administrator', 'maintenance_manager', 'member'].includes(record.role)
    ) {
      throw new MemberError('INVALID_ROLE');
    }
    if (!['active', 'inactive'].includes(record.status)) {
      throw new MemberError('INVALID_STATUS');
    }
    this.record = Object.freeze({
      id: record.id,
      congregationId: record.congregationId,
      name: normalizeName(record.name),
      phone: normalizePhone(record.phone),
      role: record.role,
      status: record.status,
    });
    Object.freeze(this);
  }

  static create(input: NewMember): Member {
    return new Member({
      id: input.id,
      congregationId: input.congregationId,
      name: input.name,
      phone: input.phone ?? null,
      role: input.role,
      status: 'active',
    });
  }

  // Rehydration validates persisted data too; transport decoding belongs at the boundary.
  static restore(record: MemberRecord): Member {
    return new Member(record);
  }

  get id(): string {
    return this.record.id;
  }
  get congregationId(): string {
    return this.record.congregationId;
  }
  get name(): string {
    return this.record.name;
  }
  get phone(): string | null {
    return this.record.phone;
  }
  get role(): MemberRole {
    return this.record.role;
  }
  get status(): MemberStatus {
    return this.record.status;
  }

  get isActiveAdministrator(): boolean {
    return this.status === 'active' && this.role === 'administrator';
  }

  editProfile(input: MemberProfile): Member {
    return new Member({
      ...this.record,
      name: input.name,
      phone: input.phone === undefined ? this.phone : input.phone,
    });
  }

  changeRole(role: MemberRole): Member {
    return new Member({ ...this.record, role });
  }

  deactivate(): Member {
    return new Member({ ...this.record, status: 'inactive' });
  }

  reactivate(): Member {
    return new Member({ ...this.record, status: 'active' });
  }

  toRecord(): Readonly<MemberRecord> {
    return this.record;
  }
}
