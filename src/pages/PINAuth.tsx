import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Flame, Lock } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  portalPathFor,
  usePinSession,
  type PINRole,
} from "@/hooks/use-pin-auth";

const COPY: Record<PINRole, { label: string; blurb: string }> = {
  staff: {
    label: "Staff Portal",
    blurb:
      "Live table reservations and the order feed for the team on the floor.",
  },
  admin: {
    label: "Admin Portal",
    blurb:
      "Menu and pricing control, restaurant photography and every reservation.",
  },
};

export default function PINAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, isLoaded, verify } = usePinSession();

  const role: PINRole =
    searchParams.get("role") === "staff" ? "staff" : "admin";

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!isLoaded) {
    return <div className="min-h-screen bg-background" />;
  }

  // A valid 24-hour session skips straight through — no re-entry needed.
  if (session) {
    return <Navigate to={portalPathFor(role)} replace />;
  }

  const copy = COPY[role];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length !== 5) return;
    if (verify(pin, role)) {
      navigate(portalPathFor(role), { replace: true });
      return;
    }
    setAttempts((count) => count + 1);
    setError("That PIN is not correct. Please try again.");
    setPin("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-gold/10 via-transparent to-transparent blur-2xl" />
      </div>

      <header className="border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
            <Flame className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Tribe of Taste</p>
            <p className="text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
              Secure access
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <motion.div
          key={attempts}
          initial={attempts > 0 ? { x: 0 } : false}
          animate={attempts > 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/60 p-8 shadow-lg shadow-black/20"
        >
          <div className="flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
              <Lock className="size-5" aria-hidden />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold">
              {copy.label}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {copy.blurb}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label
              htmlFor="portal-pin"
              className="text-center text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase"
            >
              Enter the 5-digit PIN
            </label>
            <Input
              id="portal-pin"
              ref={inputRef}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 5));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="•••••"
              className="h-12 text-center font-mono text-lg tracking-[0.6em]"
              aria-label="Access PIN"
              aria-invalid={Boolean(error)}
            />

            {error ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {error}
              </motion.p>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2"
                asChild
              >
                <Link to="/access">
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Link>
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={pin.length !== 5}
              >
                Unlock
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground/80">
            Once verified, the session stays valid on this device for 24 hours.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
