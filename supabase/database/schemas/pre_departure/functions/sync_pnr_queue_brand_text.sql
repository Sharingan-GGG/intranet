CREATE FUNCTION pre_departure.sync_pnr_queue_brand_text()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  IF NEW.brand_id IS NOT NULL THEN
    SELECT b.code INTO NEW.brand FROM pre_departure.brands b WHERE b.id = NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION pre_departure.sync_pnr_queue_brand_text() OWNER TO payload_app;