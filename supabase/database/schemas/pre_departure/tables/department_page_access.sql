CREATE TABLE pre_departure.department_page_access (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  page_id       text                     NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  department_id character varying        NOT NULL
);

ALTER TABLE pre_departure.department_page_access
  OWNER TO payload_app;

ALTER TABLE pre_departure.department_page_access
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE pre_departure.department_page_access
  ADD CONSTRAINT department_page_access_pkey PRIMARY KEY (id);

ALTER TABLE pre_departure.department_page_access
  ADD CONSTRAINT department_page_access_page_id_fkey FOREIGN KEY (page_id) REFERENCES pre_departure.pages(id) ON DELETE CASCADE;

ALTER TABLE pre_departure.department_page_access
  ADD CONSTRAINT department_page_access_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

GRANT INSERT, SELECT ON pre_departure.department_page_access TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.department_page_access TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON pre_departure.department_page_access TO service_role;