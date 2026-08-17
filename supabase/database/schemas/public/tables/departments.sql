CREATE TABLE public.departments (
  name          character varying           NOT NULL,
  description   character varying,
  lead_id       character varying,
  updated_at    timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at    timestamp(3) with time zone DEFAULT now() NOT NULL,
  org_unit_path character varying,
  id            character varying           DEFAULT (gen_random_uuid())::character varying NOT NULL,
  parent_id     character varying
);

CREATE INDEX departments_created_at_idx ON public.departments (created_at);

CREATE INDEX departments_lead_idx ON public.departments (lead_id);

CREATE UNIQUE INDEX departments_org_unit_path_idx ON public.departments (org_unit_path);

CREATE INDEX departments_updated_at_idx ON public.departments (updated_at);

ALTER TABLE public.departments
  OWNER TO payload_app;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_pkey PRIMARY KEY (id);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_parent_id_departments_id_fk FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_lead_id_users_id_fk FOREIGN KEY (lead_id) REFERENCES public.users(id) ON DELETE SET NULL;

GRANT SELECT ON public.departments TO service_role;