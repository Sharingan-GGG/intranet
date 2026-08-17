CREATE TABLE pre_departure.role_permissions (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  role       text                     NOT NULL,
  action     text                     NOT NULL,
  allowed    boolean                  DEFAULT true NOT NULL,
  updated_by character varying,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY role_permissions_select_all ON pre_departure.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY role_permissions_write_super_admin ON pre_departure.role_permissions
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.users u
     JOIN public.users_roles r ON (((r.parent_id)::text = (u.id)::text)))
  WHERE ((lower((u.email)::text) = lower((auth.jwt() ->> 'email'::text))) AND (r.value = 'super-admin'::public.enum_users_roles)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.users u
     JOIN public.users_roles r ON (((r.parent_id)::text = (u.id)::text)))
  WHERE ((lower((u.email)::text) = lower((auth.jwt() ->> 'email'::text))) AND (r.value = 'super-admin'::public.enum_users_roles)))));

ALTER TABLE pre_departure.role_permissions
  OWNER TO payload_app;

ALTER TABLE pre_departure.role_permissions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.role_permissions
  ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.role_permissions
  ADD CONSTRAINT role_permissions_role_action_key UNIQUE (ROLE, action);

ALTER TABLE pre_departure.role_permissions
  ADD CONSTRAINT role_permissions_role_check CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]));

ALTER TABLE pre_departure.role_permissions
  ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);

GRANT INSERT, SELECT ON pre_departure.role_permissions TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.role_permissions TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.role_permissions TO service_role;