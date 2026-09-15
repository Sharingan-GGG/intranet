CREATE TYPE audit.yes_no AS ENUM (
  'Yes',
  'No'
);

ALTER TYPE audit.yes_no OWNER TO payload_app;
