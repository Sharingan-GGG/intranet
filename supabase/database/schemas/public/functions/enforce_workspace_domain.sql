CREATE FUNCTION public.enforce_workspace_domain()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  allowed_domains text[] := ARRAY['complextravel.com.au', 'roundabouttravel.com.au'];
  new_email text;
  new_domain text;
  local_part text;
  clash text;
BEGIN
  new_email := lower(NEW.email);

  IF new_email IS NULL OR position('@' in new_email) = 0 THEN
    RAISE EXCEPTION 'A valid email address is required to sign in.'
      USING ERRCODE = 'check_violation';
  END IF;

  new_domain := split_part(new_email, '@', 2);
  local_part := split_part(new_email, '@', 1);

  IF NOT (new_domain = ANY (allowed_domains)) THEN
    RAISE EXCEPTION 'Sign-in is restricted to % Workspace accounts.',
      array_to_string(allowed_domains, ' and ')
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT u.email INTO clash
  FROM public.users u
  WHERE lower(split_part(u.email, '@', 1)) = local_part
    AND lower(u.email) <> new_email
  LIMIT 1;

  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'An account already exists for this person as %. Sign in with that address instead.', clash
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_workspace_domain() FROM PUBLIC;

GRANT ALL ON FUNCTION public.enforce_workspace_domain() TO service_role;