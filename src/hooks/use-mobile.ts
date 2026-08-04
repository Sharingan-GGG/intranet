import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * useSyncExternalStore keeps server + first client pass aligned (getServerSnapshot)
 * so Radix `useId` order matches (sidebar mobile vs desktop branch).
 */
function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onStoreChange)
  window.addEventListener("resize", onStoreChange)
  return () => {
    mql.removeEventListener("change", onStoreChange)
    window.removeEventListener("resize", onStoreChange)
  }
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
}
