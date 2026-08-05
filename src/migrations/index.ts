import * as migration_20260805_020606_initial from './20260805_020606_initial';
import * as migration_20260805_062332_add_department_org_unit_path from './20260805_062332_add_department_org_unit_path';
import * as migration_20260805_064706_remove_department_code from './20260805_064706_remove_department_code';
import * as migration_20260805_073412_roles_permissions_department_hasmany from './20260805_073412_roles_permissions_department_hasmany';

export const migrations = [
  {
    up: migration_20260805_020606_initial.up,
    down: migration_20260805_020606_initial.down,
    name: '20260805_020606_initial',
  },
  {
    up: migration_20260805_062332_add_department_org_unit_path.up,
    down: migration_20260805_062332_add_department_org_unit_path.down,
    name: '20260805_062332_add_department_org_unit_path',
  },
  {
    up: migration_20260805_064706_remove_department_code.up,
    down: migration_20260805_064706_remove_department_code.down,
    name: '20260805_064706_remove_department_code',
  },
  {
    up: migration_20260805_073412_roles_permissions_department_hasmany.up,
    down: migration_20260805_073412_roles_permissions_department_hasmany.down,
    name: '20260805_073412_roles_permissions_department_hasmany'
  },
];
