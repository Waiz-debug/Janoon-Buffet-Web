import * as React from "react"

const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * The viewport is an external store, so it is read through
 * `useSyncExternalStore` rather than copied into state by an effect. The effect
 * version set state synchronously on mount, which fires a second render before
 * the browser has painted anything; this reads the current answer during render
 * instead, and re-renders only when the media query actually flips.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // Server/prerender: no viewport to measure, so assume the wide layout.
    () => false,
  )
}
