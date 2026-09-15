CREATE TYPE audit.schedule_type AS ENUM (
  'Bi-Weekly',
  'Monthly',
  'Quarterly'
);

ALTER TYPE audit.schedule_type OWNER TO payload_app;
