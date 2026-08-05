import * as migration_20260805_020606_initial from './20260805_020606_initial';

export const migrations = [
  {
    up: migration_20260805_020606_initial.up,
    down: migration_20260805_020606_initial.down,
    name: '20260805_020606_initial'
  },
];
