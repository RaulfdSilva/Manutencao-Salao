import { describe, expect, it } from 'vitest';
import { Member } from '../../src/domain/members/Member';
import type {
  MemberRecord,
  MemberRole,
  MemberStatus,
} from '../../src/domain/members/Member';
import { MemberError } from '../../src/domain/members/MemberError';

const record: MemberRecord = {
  id: 'member-1',
  congregationId: 'congregation-1',
  name: 'Ana Silva',
  phone: '+55 11 99999-0000',
  role: 'member',
  status: 'active',
};

describe('Member', () => {
  it('normalizes a name without excluding accents or single names', () => {
    const member = Member.create({ ...record, name: '  João  ' });
    expect(member.name).toBe('João');
    expect(member.status).toBe('active');
  });

  it.each(['', ' ', '\n\t'])('rejects an empty name: %j', (name) => {
    expect(() => Member.create({ ...record, name })).toThrowError(
      new MemberError('INVALID_NAME'),
    );
  });

  it.each(['', ' ', '\n'])('rejects empty identifiers: %j', (id) => {
    expect(() => Member.create({ ...record, id })).toThrowError(
      new MemberError('INVALID_IDENTIFIER'),
    );
    expect(() => Member.create({ ...record, congregationId: id })).toThrowError(
      new MemberError('INVALID_IDENTIFIER'),
    );
  });

  it('rejects padded identifiers rather than changing their identity', () => {
    expect(() => Member.restore({ ...record, id: ' member-1 ' })).toThrowError(
      new MemberError('INVALID_IDENTIFIER'),
    );
  });

  it('accepts an omitted phone and normalizes blank or padded phones', () => {
    const { phone: _phone, ...withoutPhone } = record;
    expect(Member.create(withoutPhone).phone).toBeNull();
    expect(Member.create({ ...record, phone: '  ' }).phone).toBeNull();
    expect(Member.create({ ...record, phone: ' +5511999990000 ' }).phone).toBe(
      '+5511999990000',
    );
  });

  it.each<MemberRole>(['administrator', 'maintenance_manager', 'member'])(
    'accepts the single role %s',
    (role) => {
      expect(Member.create({ ...record, role }).role).toBe(role);
    },
  );

  it('rejects malformed restored values at runtime', () => {
    // Deliberately malformed external data exercises runtime validation, not type safety.
    expect(() =>
      Member.restore({ ...record, role: 'owner' as MemberRole }),
    ).toThrowError(new MemberError('INVALID_ROLE'));
    expect(() =>
      Member.restore({ ...record, status: 'deleted' as MemberStatus }),
    ).toThrowError(new MemberError('INVALID_STATUS'));
    expect(() =>
      Member.restore({ ...record, name: 10 as unknown as string }),
    ).toThrowError(new MemberError('INVALID_NAME'));
    expect(() =>
      Member.restore({ ...record, phone: 10 as unknown as string }),
    ).toThrowError(new MemberError('INVALID_PHONE'));
  });

  it('returns new immutable members and preserves identity through every transition', () => {
    const original = Member.restore(record);
    const edited = original.editProfile({ name: 'Ana Souza' });
    const promoted = edited.changeRole('administrator');
    const inactive = promoted.deactivate();
    const reactivated = inactive.reactivate();
    for (const member of [edited, promoted, inactive, reactivated]) {
      expect(member.id).toBe(original.id);
      expect(member.congregationId).toBe(original.congregationId);
      expect(Object.isFrozen(member)).toBe(true);
      expect(Object.isFrozen(member.toRecord())).toBe(true);
    }
    expect(original.toRecord()).toEqual(record);
    expect(edited.phone).toBe(original.phone);
    expect(promoted.isActiveAdministrator).toBe(true);
    expect(inactive.isActiveAdministrator).toBe(false);
    expect(reactivated.isActiveAdministrator).toBe(true);
  });

  it('clears a phone only when explicitly requested and validates edits', () => {
    const member = Member.restore(record);
    expect(
      member.editProfile({ name: member.name, phone: null }).phone,
    ).toBeNull();
    expect(() => member.editProfile({ name: ' ' })).toThrowError(
      new MemberError('INVALID_NAME'),
    );
  });
});
