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
  version: 1,
};

describe('Member', () => {
  it('normalizes a name without excluding accents or single names', () => {
    const member = Member.create({ ...record, name: '  João  ' });
    expect(member.name).toBe('João');
    expect(member.status).toBe('active');
    expect(member.version).toBe(1);
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

  it('increments the version exactly once for each effective change', () => {
    const original = Member.restore(record);
    const edited = original.editProfile({ name: 'Maria', phone: null });
    const promoted = edited.changeRole('administrator');
    const inactive = promoted.deactivate();
    const active = inactive.reactivate();
    expect(
      [original, edited, promoted, inactive, active].map((m) => m.version),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(original.version).toBe(1);
  });

  it('does not advance the version for normalized no-ops', () => {
    const member = Member.restore(record);
    expect(member.editProfile({ name: ' Ana Silva ' })).toBe(member);
    expect(member.changeRole('member')).toBe(member);
    expect(member.reactivate()).toBe(member);
    const inactive = member.deactivate();
    expect(inactive.deactivate()).toBe(inactive);
    expect(inactive.version).toBe(2);
  });

  it.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    undefined,
    '1',
  ])('rejects an invalid restored version: %s', (version) => {
    expect(() =>
      Member.restore({ ...record, version: version as number }),
    ).toThrowError(new MemberError('INVALID_VERSION'));
  });

  it('preserves a restored version and rejects overflow instead of losing precision', () => {
    const member = Member.restore({
      ...record,
      version: Number.MAX_SAFE_INTEGER,
    });
    expect(member.version).toBe(Number.MAX_SAFE_INTEGER);
    expect(member.reactivate()).toBe(member);
    expect(() => member.deactivate()).toThrowError(
      new MemberError('INVALID_VERSION'),
    );
  });
});
