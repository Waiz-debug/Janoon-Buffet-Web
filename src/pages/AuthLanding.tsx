import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Flame, Lock, PanelRight, Users } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  portalPathFor,
  usePinSession,
  type PINRole,
} from "@/hooks/use-pin-auth";

type RoleCard = {
  id: "user" | "staff" | "admin";
  label: string;
  description: string;
  cta: string;
  icon: typeof Users;
  pin: boolean;
  accent: string;
  glow: string;
};

const ROLE_CARDS: RoleCard[] = [
  {
    id: "user",
    label: "Customer",
    description:
      "Tonight's buffet, the full menu and table booking — open to every guest, no sign-in required.",
    cta: "Enter the restaurant",
    icon: Users,
    pin: false,
    accent:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40",
    glow: "shadow-[0_0_18px_-4px_rgba(52,211,153,0.25)]",
  },
  {
    id: "staff",
    label: "Staff Portal",
    description:
      "Tonight's bookings and the order feed, for the team working the floor.",
    cta: "Staff sign-in",
    icon: PanelRight,
    pin: true,
    accent:
      "bg-sky-500/10 text-sky-300 border-sky-500/20 hover:border-sky-500/40",
    glow: "shadow-[0_0_18px_-4px_rgba(56,189,248,0.25)]",
  },
  {
    id: "admin",
    label: "Admin Portal",
    description:
      "Menu and pricing control, real restaurant photography and every reservation, in one place.",
    cta: "Admin sign-in",
    icon: Lock,
    pin: true,
    accent:
      "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:border-amber-500/40",
    glow: "shadow-[0_0_18px_-4px_rgba(251,191,36,0.25)]",
  },
];

export default function AuthLanding() {
  const navigate = useNavigate();
  const { session, isLoaded, verify } = usePinSession();

  const [searchParams, setSearchParams] = useSearchParams();
  const modalRole = searchParams.get("unlock");

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // A live 24-hour session goes straight to its portal — no re-entry.
  useEffect(() => {
    if (isLoaded && session) {
      navigate(portalPathFor(session.role), { replace: true });
    }
  }, [isLoaded, session, navigate]);

  // ?unlock=staff|admin deep-link opens the modal directly.
  useEffect(() => {
    if (modalRole !== "staff" && modalRole !== "admin") return;
    setPin("");
    setError(null);
  }, [modalRole]);

  const openModal = (role: PINRole) => {
    setError(null);
    setPin("");
    setSearchParams({ unlock: role }, { replace: true });
  };

  const closeModal = () => {
    setSearchParams({}, { replace: true });
    setPin("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const role = modalRole;
    if ((role !== "staff" && role !== "admin") || pin.length !== 5) return;
    setSubmitting(true);
    try {
      if (verify(pin, role)) {
        navigate(portalPathFor(role), { replace: true });
        return;
      }
      setAttempts((count) => count + 1);
      setError("That PIN is not correct. Please try again.");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Warm hearth backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <HeroAmbience />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Flame className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Tribe of Taste</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
                Lahore · 24/7 open buffet
              </p>
            </div>
          </div>
          <Link
            to="/restaurant"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip to the restaurant site
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-12 text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.7rem] tracking-[0.2em] text-gold uppercase">
              Secure access
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Who are you coming in as?
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Guests can walk straight in. The staff and admin doors open with a
              PIN — entered once, then remembered for the day.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-3">
            {ROLE_CARDS.map((role, index) => {
              const Icon = role.icon;
              return (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: 0.12 * index,
                    ease: "easeOut",
                  }}
                  className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-6 transition-colors hover:border-gold/25 hover:bg-card"
                >
                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl border ${role.accent} ${role.glow}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>

                  <div className="flex-1">
                    <h2 className="font-display text-lg font-semibold">
                      {role.label}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {role.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {role.pin ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full gap-2 border ${role.accent}`}
                        onClick={() => openModal(role.id as PINRole)}
                      >
                        <Lock className="size-3.5" aria-hidden />
                        {role.cta}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="lg"
                        className="w-full gap-2 shadow-lg shadow-black/20"
                      >
                        <Link to="/restaurant">
                          {role.cta}
                          <span aria-hidden>→</span>
                        </Link>
                      </Button>
                    )}
                    <p className="text-[0.7rem] text-muted-foreground/80">
                      {role.pin
                        ? "PIN protected · remembered for 24 hours"
                        : "No account needed"}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground/80">
            Staff and admin share the PIN 01234. Once verified, the session is
            remembered on this device for 24 hours.
          </p>
        </div>
      </main>

      {modalRole ? (
        <PinModal
          role={modalRole as PINRole}
          pin={pin}
          error={error}
          attempts={attempts}
          submitting={submitting}
          onPinChange={(value) => {
            setPin(value);
            setError(null);
          }}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

function PinModal({
  role,
  pin,
  error,
  attempts,
  submitting,
  onPinChange,
  onSubmit,
  onClose,
}: {
  role: PINRole;
  pin: string;
  error: string | null;
  attempts: number;
  submitting: boolean;
  onPinChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const copy =
    role === "staff"
      ? {
          label: "Staff Portal",
          blurb: "Live table reservations and the order feed for the floor team.",
        }
      : {
          label: "Admin Portal",
          blurb:
            "Menu and pricing control, restaurant photography and every reservation.",
        };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.label} PIN verification`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        key={attempts}
        initial={attempts > 0 ? { x: [0, -8, 8, -5, 5, 0] } : { scale: 0.96, opacity: 0 }}
        animate={{ x: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-8 shadow-2xl shadow-black/40"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
            <Lock className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold">
            {copy.label}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy.blurb}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label
            htmlFor="portal-pin"
            className="text-center text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase"
          >
            Enter the 5-digit PIN
          </label>
          <Input
            id="portal-pin"
            autoFocus
            value={pin}
            onChange={(event) => onPinChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
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
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={pin.length !== 5 || submitting}
            >
              Unlock
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground/80">
          Once verified, this device stays unlocked for 24 hours.
        </p>
      </motion.div>
    </motion.div>
  );
}

function HeroAmbience() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 h-[55vh] overflow-hidden"
      style={{ maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)" }}
    >
      {/* Soft ember glow behind the hero text */}
      <div className="absolute left-1/2 top-0 h-72 w-[90%] -translate-x-1/2 bg-gradient-to-b from-gold/10 via-transparent to-transparent blur-3xl" />

      {/* Subtle floating embers */}
      <div className="pointer-events-none absolute inset-x-0 top-20 h-40">
        <FloatEmber index={0} size={1.5} top={12} left={18} duration={7} delay={0} />
        <FloatEmber index={1} size={1.5} top={30} left={38} duration={8.5} delay={0.8} />
        <FloatEmber index={2} size={1.5} top={18} left={60} duration={6.5} delay={1.6} />
        <FloatEmber index={3} size={1.5} top={40} left={78} duration={9} delay={2.2} />
        <FloatEmber index={4} size={1.5} top={10} left={88} duration={7.5} delay={3} />
      </div>
    </div>
  );
}

function FloatEmber({
  index,
  size,
  top,
  left,
  duration,
  delay,
}: {
  index: number;
  size: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
}) {
  return (
    <motion.span
      key={index}
      className="absolute rounded-full bg-gold/70 blur-[1px]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
      }}
      animate={{ y: ["0vh", "-70vh"], opacity: [0, 0.85, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}
