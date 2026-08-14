import * as migration_20260805_020606_initial from './20260805_020606_initial';
import * as migration_20260805_062332_add_department_org_unit_path from './20260805_062332_add_department_org_unit_path';
import * as migration_20260805_064706_remove_department_code from './20260805_064706_remove_department_code';
import * as migration_20260805_073412_roles_permissions_department_hasmany from './20260805_073412_roles_permissions_department_hasmany';
import * as migration_20260806_093500_permissions_role_pages_drop_roles from './20260806_093500_permissions_role_pages_drop_roles';
import * as migration_20260806_101922_add_internal_page_routes from './20260806_101922_add_internal_page_routes';
import * as migration_20260806_102822_add_permissions_excluded_pages from './20260806_102822_add_permissions_excluded_pages';
import * as migration_20260806_110000_quick_links_department_hasmany from './20260806_110000_quick_links_department_hasmany';
import * as migration_20260806_113000_quick_links_group_template from './20260806_113000_quick_links_group_template';
import * as migration_20260806_120000_add_posts_expiry_date from './20260806_120000_add_posts_expiry_date';
import * as migration_20260806_130000_add_events_button_fields from './20260806_130000_add_events_button_fields';
import * as migration_20260806_140000_departments_uuid_id from './20260806_140000_departments_uuid_id';
import * as migration_20260812_150000_add_feedback_card_fields from './20260812_150000_add_feedback_card_fields';
import * as migration_20260812_160000_add_feedback_card_fields_to_versions from './20260812_160000_add_feedback_card_fields_to_versions';
import * as migration_20260814_024532_add_header_subitems from './20260814_024532_add_header_subitems';
import * as migration_20260814_044850_add_permissions_users_field from './20260814_044850_add_permissions_users_field';

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
    name: '20260805_073412_roles_permissions_department_hasmany',
  },
  {
    up: migration_20260806_093500_permissions_role_pages_drop_roles.up,
    down: migration_20260806_093500_permissions_role_pages_drop_roles.down,
    name: '20260806_093500_permissions_role_pages_drop_roles',
  },
  {
    up: migration_20260806_101922_add_internal_page_routes.up,
    down: migration_20260806_101922_add_internal_page_routes.down,
    name: '20260806_101922_add_internal_page_routes',
  },
  {
    up: migration_20260806_102822_add_permissions_excluded_pages.up,
    down: migration_20260806_102822_add_permissions_excluded_pages.down,
    name: '20260806_102822_add_permissions_excluded_pages',
  },
  {
    up: migration_20260806_110000_quick_links_department_hasmany.up,
    down: migration_20260806_110000_quick_links_department_hasmany.down,
    name: '20260806_110000_quick_links_department_hasmany',
  },
  {
    up: migration_20260806_113000_quick_links_group_template.up,
    down: migration_20260806_113000_quick_links_group_template.down,
    name: '20260806_113000_quick_links_group_template',
  },
  {
    up: migration_20260806_120000_add_posts_expiry_date.up,
    down: migration_20260806_120000_add_posts_expiry_date.down,
    name: '20260806_120000_add_posts_expiry_date',
  },
  {
    up: migration_20260806_130000_add_events_button_fields.up,
    down: migration_20260806_130000_add_events_button_fields.down,
    name: '20260806_130000_add_events_button_fields',
  },
  {
    up: migration_20260806_140000_departments_uuid_id.up,
    down: migration_20260806_140000_departments_uuid_id.down,
    name: '20260806_140000_departments_uuid_id',
  },
  {
    up: migration_20260812_150000_add_feedback_card_fields.up,
    down: migration_20260812_150000_add_feedback_card_fields.down,
    name: '20260812_150000_add_feedback_card_fields',
  },
  {
    up: migration_20260812_160000_add_feedback_card_fields_to_versions.up,
    down: migration_20260812_160000_add_feedback_card_fields_to_versions.down,
    name: '20260812_160000_add_feedback_card_fields_to_versions',
  },
  {
    up: migration_20260814_024532_add_header_subitems.up,
    down: migration_20260814_024532_add_header_subitems.down,
    name: '20260814_024532_add_header_subitems',
  },
  {
    up: migration_20260814_044850_add_permissions_users_field.up,
    down: migration_20260814_044850_add_permissions_users_field.down,
    name: '20260814_044850_add_permissions_users_field'
  },
];
