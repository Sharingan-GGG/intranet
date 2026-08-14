import type { Metadata } from "next"
import { headers as nextHeaders } from "next/headers"
import { redirect } from "next/navigation"
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query"
import { getPayload } from "payload"
import configPromise from "@payload-config"

import { WorkPageShell } from "@/components/work/work-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { loadDashboard } from "@/lib/pnr-dashboard-data"
import {
  DEFAULT_PNR_QUEUE_FILTERS,
  pnrQueueQueryKey,
  pnrQueueSearch,
} from "@/lib/pnr-queue-query"
import {
  BRANDS,
  parsePreDepartureRoute,
  preDeparturePath,
} from "@/lib/pre-departure-route"
import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions } from "@/lib/permissions-server"
import { hasPageAccess } from "@/access/departmentPermissions"

// The queue changes on every scan, move and delete, and is scoped per user — so this
// page must be rendered per request and never cached or prerendered.
export const dynamic = "force-dynamic"
export const revalidate = 0

type Args = {
  params: Promise<{ brand: string; view?: string[] }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { brand } = await params
  // Role gating happens in the page (which redirects an unauthorised brand away), so
  // the title only needs the brand to be real before naming it.
  const label = BRANDS.find((b) => b.toLowerCase() === brand?.toLowerCase())
  return {
    title: label
      ? `Pre Departure ${label} | CTG Intranet`
      : "Pre Departure | CTG Intranet",
    description: "CTG Intranet — Pre Departure PNR review",
  }
}

export default async function PreDeparturePage({ params }: Args) {
  const { brand: brandSegment, view } = await params

  const profile = await getPreDepartureUser()

  if (!profile) redirect("/login")

  // The role tiers below only vary what someone sees *inside* the module (brands, tabs,
  // actions) — they have no department/specific-user concept. Whether someone gets in at
  // all is decided by the Permissions collection's "route:pre-departure" rule instead,
  // so department/user scoping only needs to exist in one place.
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!(await hasPageAccess(payload, user, "route:pre-departure"))) {
    return (
      <div className="flex h-svh min-h-0 flex-col items-center justify-center gap-4 bg-background p-6">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>You don&apos;t have permission to view Pre Departure.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <a href="/">Back to home</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const admin = createServiceClient()

  // The profiles table had a `status` column gating access on an "active" value. Payload has
  // no equivalent — holding a user record *is* being active — so the check is gone, along
  // with the /pending redirect it pointed at, which was never a real route.
  const role = profile.role ?? "user"
  const segments = [brandSegment, ...(view ?? [])]
  const route = parsePreDepartureRoute(brandSegment, view ?? [], role)

  // Anything the parser had to clamp — a misspelled or upper-case brand, a brand or
  // detail tab this role cannot see, junk trailing segments — gets a single redirect
  // to the canonical path, so the URL always describes what is actually on screen.
  const canonical = preDeparturePath(route)
  if (canonical !== `/pre-departure/${segments.map(encodeURIComponent).join("/")}`) {
    redirect(canonical)
  }

  // Fetch permissions for the user's role
  const permissions = await getRolePermissions(admin, role)

  // Render the first paint with the queue already populated, instead of shipping a
  // skeleton and waiting on a client round-trip. `loadDashboard` is the same function
  // the API route calls, and the key matches the client hook's — including the brand
  // this route pins — so hydration adopts this data rather than refetching it.
  const filters = { ...DEFAULT_PNR_QUEUE_FILTERS, brand: route.brand }
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: pnrQueueQueryKey(filters),
    queryFn: async () => {
      const result = await loadDashboard(pnrQueueSearch(filters))
      // Mirror the hook: a failed load must reject so the client retries, rather
      // than hydrating an empty queue that looks like a legitimately empty one.
      if (!result.ok) throw new Error(result.error ?? "Queue load failed")
      return result.items ?? []
    },
  })

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WorkPageShell
          role={role}
          profileId={profile.id ?? undefined}
          permissions={permissions}
          userName={profile.full_name ?? undefined}
          route={route}
        />
      </HydrationBoundary>
    </div>
  )
}
