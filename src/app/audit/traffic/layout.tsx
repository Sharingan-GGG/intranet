/**
 * Holds the Traffic list and the drawer slot beside it.
 *
 * The slot is what lets a page's detail open over the table without the table
 * being torn down and re-fetched: `@drawer/(.)page-detail` intercepts the
 * navigation, so `children` keeps rendering the list it already had. A hard
 * load of the same URL misses the interception and renders the full page
 * instead, which is why both exist.
 */
export default function AuditTrafficLayout({
  children,
  drawer,
}: {
  children: React.ReactNode
  drawer: React.ReactNode
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  )
}
