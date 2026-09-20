import { JanoonMark } from "@/components/tribe/JanoonMark";
import { Button } from "@/components/ui/button";
import {
  NOT_ADMIN_MESSAGE,
  useStaffAuth,
  type StaffRole,
} from "@/hooks/use-staff-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router";

/**
 * Gate for the staff and admin portals.
 *
 * What it checks is a Supabase Auth session plus a row in `staff_members`, both
 * of which the database verifies on every read and write — so this component
 * decides which *screen* you see, not what you may do. Deleting it, or faking
 * the session in devtools, gets you a portal that renders and then fails on
 * every query, because the policies ask Postgres, not the browser.
 *
 * The two doors are not the same door: `/admin` opens only for an account that
 * holds the `admin` role, while `/staff` is the floor team's desk and stays
 * open to admins as well. A staff account that reaches `/admin` is *refused* —
 * it is not forwarded to `/staff`. Being moved to another screen looks like the
 * door it asked for had opened, and hides the fact that the admin console said
 * no; so the refusal is shown, with the staff desk and a sign-out offered next
 * to it.
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

  // The row in `staff_members` decides, and `/admin` asks it for `admin` — not
  // merely for "someone who works here". Multi-role accounts are asked for the
  // role this door needs, and holding it alongside `staff` is enough.
  if (role === "admin" && !session.roles.includes("admin")) {
    return <AccessDenied email={session.email} />;
  }

  return <>{children}</>;
}

/**
 * The admin door's refusal, in the restaurant's own styling.
 *
 * Deliberately a dead end with two honest ways out — the staff desk this
 * account can actually use, or signing out to try another account — rather than
 * a redirect the person never asked for.
 */
function AccessDenied({ email }: { email: string }) {
  const { signOut } = useStaffAuth();

  return (
    <main className="hearth-glow flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/80 p-7 text-center shadow-[0_44px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur sm:p-9">
        <div className="brass-rule mx-auto h-px w-28" aria-hidden />
        <JanoonMark className="mx-auto mt-7 size-12" />
        <span className="mt-5 inline-flex size-11 items-center justify-center rounded-2xl border border-ember/30 bg-ember/10 text-ember">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {NOT_ADMIN_MESSAGE}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {email ? (
            <>
              <span className="text-foreground/90">{email}</span> is signed in,
              but this account does not hold the administrator role.
            </>
          ) : (
            "This account does not hold the administrator role."
          )}{" "}
          The admin console needs an account marked as an admin in the staff
          records; the staff desk is still open to you.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 flex-1 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
          >
            <Link to="/staff">Open the staff desk</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 border-gold/25"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground/70">
          Ask an administrator to grant this account the admin role from the
          Team tab, then sign in again.
        </p>
      </div>
    </main>
  );
}
