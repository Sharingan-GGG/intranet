-- Custom Access Token hook: drops `user_metadata` from every issued JWT.
--
-- One SSO session is ~4.2KB of Cookie header, and the JWT is ~1,350B of that before base64
-- inflates it by a third. Most of the JWT is `user_metadata` re-embedded from auth.users --
-- Google's avatar_url, picture, full_name, name, iss, sub, provider_id, custom_claims -- none
-- of which is read from the token: the app uses only the `email` claim (src/middleware.ts and
-- src/collections/Users/supabaseStrategy.ts), and takes name and avatar from the Payload
-- `users` record instead. The sign-in callback still reads user_metadata, but from the
-- exchangeCodeForSession() response rather than the token, so it is unaffected.
--
-- Removing it shrinks every session cookie for as long as the session lives, which is what
-- keeps the Cookie header inside the header buffers of the nginx -> LiteSpeed -> Node chain.
--
-- Enable at Authentication -> Hooks -> Customize Access Token (JWT) Claims after running this.

CREATE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  -- Anything other than the documented shape is passed through untouched: a hook that raises
  -- or returns something malformed fails the token issuance, i.e. blocks every sign-in.
  IF jsonb_typeof(event -> 'claims') <> 'object' THEN
    RETURN event;
  END IF;

  RETURN jsonb_set(event, '{claims}', (event -> 'claims') - 'user_metadata');
END;
$function$;

-- Auth runs the hook as supabase_auth_admin, which has no access to `public` by default.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Nobody else needs to call it, least of all a signed-in client.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
