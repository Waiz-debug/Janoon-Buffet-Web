import { useStaffAuth, type StaffRole } from "@/hooks/use-staff-auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

/**
 * Gate for the staff and admin portals.
 *
 * What it checks is a Supabase Auth session plus a row in `staff_members`, both
 * of which the database verifies on every read and write — so this component
 * decides which *screen* you see, not what you may do. Deleting it, or faking
 * the session in devtools, gets you a portal that renders and then fails on
 * every query, because the policies ask Postgres, not the browser.
 *
 * Both roles open both doors, exactly as the shared PIN did; `role` is here for
 * the day a screen needs to be admin-only.
 */
export function RequireRole({
  role,
  children,
}: {
  role: StaffRole;
  children: ReactNode;
}) {
  const { session, isLoaded } = useStaffAuth();

  // Wait for the session to resolve. Redirecting first would bounce a signed-in
  // visitor to the gateway on every refresh.
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!session) {
    // Back to the gateway with the sign-in dialog pre-opened for this door.
    return <Navigate to={`/?unlock=${role}`} replace />;
  }

  return <>{children}</>;
}
