/**
 * Shown to a signed-in user who does not hold `route:audit`.
 *
 * Rendered inline rather than redirected, matching pre-departure: the person is
 * legitimately signed in, and bouncing them to /login would suggest their
 * session had expired when the real answer is that their department has not
 * been granted this page.
 */
export function AuditAccessDenied() {
  return (
    <div className="shell py-16">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="eyebrow">CTG Audit Hub</p>
        <h1 className="mt-2 text-xl font-bold">Access denied</h1>
        <p className="muted mt-3 text-sm">
          Your account does not have access to the Audit Hub. Ask an administrator to grant your
          department the <code>Route: Audit Hub</code> permission.
        </p>
      </div>
    </div>
  )
}
