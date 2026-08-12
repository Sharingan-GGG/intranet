// Supabase Auth is the sign-in path for everyone; Payload's own email/password strategy is
// only a fallback for the super-admin account, edited directly (not via the admin UI). Hiding
// this block — rather than disabling the local strategy — keeps that fallback working while
// preventing anyone, including admins, from changing it through /admin/account or the Users
// collection edit view. `.auth-fields` only ever renders on an auth-enabled collection's edit
// view, which in this project is Users alone, so a global rule is safe to apply admin-wide.
export function HideAuthFields() {
  return <style>{`.auth-fields { display: none !important; }`}</style>
}
