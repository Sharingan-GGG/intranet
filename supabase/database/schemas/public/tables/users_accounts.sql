CREATE TABLE public.users_accounts (
  _order              integer           NOT NULL,
  _parent_id          character varying NOT NULL,
  id                  character varying NOT NULL,
  provider            character varying NOT NULL,
  provider_account_id character varying NOT NULL,
  type                character varying NOT NULL
);

CREATE INDEX users_accounts_order_idx ON public.users_accounts (_order);

CREATE INDEX users_accounts_provider_account_id_idx ON public.users_accounts (provider_account_id);

CREATE INDEX users_accounts_parent_id_idx ON public.users_accounts (_parent_id);

ALTER TABLE public.users_accounts
  OWNER TO payload_app;

ALTER TABLE public.users_accounts
  ADD CONSTRAINT users_accounts_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.users_accounts
  ADD CONSTRAINT users_accounts_pkey PRIMARY KEY (id);