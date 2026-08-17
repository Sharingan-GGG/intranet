CREATE FUNCTION pre_departure.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION pre_departure.update_updated_at() OWNER TO payload_app;