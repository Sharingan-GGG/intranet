import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN_ROLE_VALUES, isAdmin, parseAdminRoleValues, rolesFromIntranetRoles } from './roles';

describe('rolesFromIntranetRoles', () => {
  it('super-admin and admin → staff + admin', () => {
    expect(rolesFromIntranetRoles(['super-admin'])).toEqual(['user', 'admin']);
    expect(rolesFromIntranetRoles(['admin'])).toEqual(['user', 'admin']);
    expect(rolesFromIntranetRoles(['Super-Admin'])).toEqual(['user', 'admin']); // case doesn't matter
  });

  it('matching ignores case and surrounding spaces', () => {
    expect(rolesFromIntranetRoles(['  admin '])).toEqual(['user', 'admin']);
  });

  it('an admin value among other roles still counts', () => {
    expect(rolesFromIntranetRoles(['user', 'editor', 'super-admin'])).toEqual(['user', 'admin']);
  });

  it('editor, user, or no role at all → normal staff', () => {
    expect(rolesFromIntranetRoles(['editor'])).toEqual(['user']);
    expect(rolesFromIntranetRoles(['user'])).toEqual(['user']);
    expect(rolesFromIntranetRoles([])).toEqual(['user']);
  });

  it('fails closed: blanks, nulls and near-misses never grant admin', () => {
    expect(rolesFromIntranetRoles([null, undefined, '', '   '])).toEqual(['user']);
    expect(rolesFromIntranetRoles(['administrator', 'not-admin', 'super-admin-readonly', 'super--admin'])).toEqual(['user']);
  });

  it('uses a custom admin list when given one', () => {
    expect(rolesFromIntranetRoles(['super-admin'], ['super-admin'])).toEqual(['user', 'admin']);
    expect(rolesFromIntranetRoles(['admin'], ['super-admin'])).toEqual(['user']); // defaults replaced, not added to
  });
});

describe('parseAdminRoleValues (QUIZ_ADMIN_ROLE_VALUES)', () => {
  it('missing or empty → defaults', () => {
    expect(parseAdminRoleValues(undefined)).toEqual(DEFAULT_ADMIN_ROLE_VALUES);
    expect(parseAdminRoleValues('')).toEqual(DEFAULT_ADMIN_ROLE_VALUES);
    expect(parseAdminRoleValues(' , ,')).toEqual(DEFAULT_ADMIN_ROLE_VALUES);
  });
  it('comma-separated list, trimmed', () => {
    expect(parseAdminRoleValues('super-admin, editor ,')).toEqual(['super-admin', 'editor']);
  });
});

describe('isAdmin', () => {
  it('true only with the admin role', () => {
    expect(isAdmin({ role: ['user', 'admin'] })).toBe(true);
    expect(isAdmin({ role: ['user'] })).toBe(false);
    expect(isAdmin({ role: [] })).toBe(false);
  });
});
