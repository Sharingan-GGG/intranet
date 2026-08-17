CREATE TABLE public.users (
  id                        character varying           NOT NULL,
  email_verified            timestamp(3) with time zone,
  name                      character varying,
  image                     character varying,
  updated_at                timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at                timestamp(3) with time zone DEFAULT now() NOT NULL,
  email                     character varying           NOT NULL,
  reset_password_token      character varying,
  reset_password_expiration timestamp(3) with time zone,
  salt                      character varying,
  hash                      character varying,
  login_attempts            numeric                     DEFAULT 0,
  lock_until                timestamp(3) with time zone,
  department_id             character varying
);

CREATE UNIQUE INDEX users_email_idx ON public.users (email);

CREATE INDEX users_created_at_idx ON public.users (created_at);

CREATE INDEX users_updated_at_idx ON public.users (updated_at);

ALTER TABLE public.users
  OWNER TO payload_app;

ALTER TABLE public.users
  ADD CONSTRAINT users_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

GRANT SELECT ON public.users TO service_role;