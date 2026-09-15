CREATE TYPE audit.status_type AS ENUM (
  'Not Yet Started',
  'Scheduled',
  'In Progress',
  'Done',
  'In Review',
  'Error'
);

ALTER TYPE audit.status_type OWNER TO payload_app;
