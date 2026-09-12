import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { readPinSession, type PINRole } from "@/hooks/use-pin-auth";

/** Gate for the PIN portals. Staff and admin share one PIN, so any valid
 *  24-hour session unlocks either dashboard — no re-entry on every click. */
export function RequirePin({
  role,
  children,
}: {
  role: PINRole;
  children: ReactNode;
}) {
  if (!readPinSession()) {
    // Back to the gateway landing page with the PIN modal pre-opened.
    return <Navigate to={`/?unlock=${role}`} replace />;
  }
  return <>{children}</>;
}
