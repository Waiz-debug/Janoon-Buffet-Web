import { Button } from "@/components/ui/button";
import { useStaffAuth } from "@/hooks/use-staff-auth";
import { Flame, LogOut, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import type { ReactNode } from "react";

type PortalFrameProps = {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PortalFrame({
  badge,
  title,
  description,
  children,
}: PortalFrameProps) {
  const navigate = useNavigate();
  const { session, signOut: endSession } = useStaffAuth();

  // Ends the Supabase Auth session, so the guard and every table policy stop
  // answering to this device at the same moment.
  const signOut = async () => {
    await endSession();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-gold/10 via-transparent to-transparent blur-2xl" />
      </div>

      <header className="border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Flame className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-base font-semibold leading-tight">
                Janoon
              </span>
              <span className="block text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
                {badge}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/restaurant">Public site</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="gap-2"
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <ShieldCheck className="size-3.5" aria-hidden />
          {session ? `${session.email} · ${session.roles.join(", ")}` : "Staff access"}
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

type PortalCardProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  ready: boolean;
  action?: { label: string; href: string };
};

export function PortalCard({
  icon: Icon,
  title,
  body,
  ready,
  action,
}: PortalCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-6">
      <span className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-gold">
        <Icon className="size-4" aria-hidden />
      </span>
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {ready && action ? (
        <Button asChild variant="outline" size="sm" className="w-fit gap-2">
          <Link to={action.href}>
            {action.label}
            <span aria-hidden>→</span>
          </Link>
        </Button>
      ) : (
        <span className="w-fit rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[0.7rem] text-muted-foreground">
          Wiring up next
        </span>
      )}
    </div>
  );
}
