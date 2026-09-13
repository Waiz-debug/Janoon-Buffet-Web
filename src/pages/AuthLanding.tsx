import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ChefHat,
  ChevronDown,
  Clock,
  Flame,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { SmartImage } from "@/components/tribe/SmartImage";
import { HearthScene } from "@/components/tribe/HearthScene";
import { Button } from "@/components/ui/button";
import {
  portalPathFor,
  usePinSession,
  type PINRole,
} from "@/hooks/use-pin-auth";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT } from "@/lib/restaurant";

const HIGHLIGHTS = [
  {
    icon: UtensilsCrossed,
    value: RESTAURANT.buffetRange,
    label: "All-you-can-eat buffet, per person",
  },
  {
    icon: Clock,
    value: "Open 24 hours",
    label: "Charcoal grills going all night",
  },
  {
    icon: Star,
    value: `${RESTAURANT.rating} / 5`,
    label: `${RESTAURANT.reviewCount}+ Google reviews`,
  },
] as const;

export default function AuthLanding() {
  const navigate = useNavigate();
  const { session, isLoaded, verify } = usePinSession();
  const { heroImage } = useLiveSite();
  const backdrop = heroImage ?? RESTAURANT.heroImage;

  const [searchParams, setSearchParams] = useSearchParams();
  const modalRole = searchParams.get("unlock");

  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // A live 24-hour session goes straight to its portal — no re-entry.
  useEffect(() => {
    if (isLoaded && session) {
      navigate(portalPathFor(session.role), { replace: true });
    }
  }, [isLoaded, session, navigate]);

  const openModal = (role: PINRole) => {
    setError(null);
    setSearchParams({ unlock: role }, { replace: true });
  };

  const closeModal = () => {
    setSearchParams({}, { replace: true });
    setError(null);
  };

  const handleVerify = (value: string) => {
    const role = modalRole;
    if ((role !== "staff" && role !== "admin") || value.length !== 5) return;
    setSubmitting(true);
    if (verify(value, role)) {
      navigate(portalPathFor(role), { replace: true });
      return;
    }
    setAttempts((count) => count + 1);
    setError("That PIN is not correct. Please try again.");
    setSubmitting(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {modalRole ? (
        <PinModal
          role={modalRole as PINRole}
          error={error}
          attempts={attempts}
          submitting={submitting}
          onVerify={handleVerify}
          onClearError={() => setError(null)}
          onClose={closeModal}
        />
      ) : null}

      {/* ————— Immersive hero ————— */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
        {/* Backdrop: the restaurant photo under the heritage scene art */}
        <div aria-hidden className="absolute inset-0 -z-30">
          <SmartImage
            src={backdrop}
            alt=""
            loading="eager"
            className="h-full w-full object-cover opacity-30"
          />
        </div>
        <HearthScene className="absolute inset-x-0 bottom-0 -z-20 h-full w-full opacity-75" />

        {/* Charcoal vignette so text sits in rich darkness */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-background/85 via-background/55 to-background"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_40%,rgba(0,0,0,0.5)_100%)]"
        />

        {/* Drifting smoke + firelight */}
        <motion.div
          aria-hidden
          className="absolute -left-28 top-1/4 -z-10 h-96 w-96 rounded-full bg-ember/10 blur-[110px]"
          animate={{ x: [0, 46, -18, 0], y: [0, -34, 22, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full bg-gold/10 blur-[100px]"
          animate={{ x: [0, -38, 20, 0], y: [0, 26, -18, 0] }}
          transition={{ duration: 23, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-0 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-ember/15 blur-[120px]"
          animate={{ opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Minimal top bar */}
        <header className="relative z-10 px-4 pt-5 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-background/50 text-gold backdrop-blur">
                <Flame className="size-4" aria-hidden />
              </span>
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.24em] text-foreground/80">
                Lahore · Natha Singh Wala
              </span>
            </div>
            <a
              href={RESTAURANT.phoneHref}
              className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-gold/40 hover:text-foreground sm:inline-flex"
            >
              <Phone className="size-3.5 text-gold/80" aria-hidden />
              {RESTAURANT.phoneDisplay}
            </a>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-background/55 px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-gold backdrop-blur"
          >
            <Flame className="size-3.5" aria-hidden />
            Open-air terrace · minutes from DHA Phase 5
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="mt-6 font-display text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Tribe of{" "}
            <span className="bg-gradient-to-r from-gold via-gold to-ember bg-clip-text text-transparent">
              Taste
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Lahore&apos;s 24/7 open buffet — charcoal BBQ, clay-pot handi and
            desi desserts served on the terrace, around the clock.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="group h-13 w-full gap-2 bg-gradient-to-r from-gold to-ember px-8 text-base font-semibold text-primary-foreground shadow-[0_16px_44px_-12px_rgba(227,179,65,0.5)] transition-all duration-300 hover:shadow-[0_22px_60px_-12px_rgba(227,179,65,0.65)] sm:w-auto"
            >
              <Link to="/restaurant">
                Get Started
                <ArrowRight className="size-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-13 w-full border-gold/25 bg-background/40 px-7 backdrop-blur transition-colors hover:border-gold/50 hover:bg-secondary/60 sm:w-auto"
            >
              <Link to="/restaurant#menu">View menu &amp; prices</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-7 text-xs text-muted-foreground/90 sm:text-sm"
          >
            Tonight&apos;s special:{" "}
            <span className="text-gold">charcoal-grilled fish</span> · Children
            under six dine free
          </motion.p>
        </div>

        {/* Scroll hint */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="relative z-10 flex justify-center pb-6"
        >
          <motion.span
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-gold/60"
          >
            <ChevronDown className="size-5" />
          </motion.span>
        </motion.div>
      </section>

      {/* ————— Highlights strip ————— */}
      <section className="relative z-10 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mx-auto -mt-9 grid max-w-4xl gap-3 sm:grid-cols-3"
        >
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card/80 px-5 py-4 backdrop-blur-md transition-colors duration-300 hover:border-gold/30"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                <item.icon className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="font-display text-base font-semibold leading-tight">
                  {item.value}
                </p>
                <p className="text-xs leading-snug text-muted-foreground">
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ————— Footer: contact + discreet house access ————— */}
      <footer className="relative z-10 mt-auto px-4 pt-14 pb-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl"
        >
          <div className="brass-rule h-px w-full" aria-hidden />

          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 pt-7 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock className="size-3.5 text-gold/70" aria-hidden />
              Open 24 hours
            </span>
            <a
              href={RESTAURANT.phoneHref}
              className="inline-flex items-center gap-2 transition-colors hover:text-gold"
            >
              <Phone className="size-3.5 text-gold/70" aria-hidden />
              {RESTAURANT.phoneDisplay}
            </a>
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-3.5 text-gold/70" aria-hidden />
              Natha Singh Wala · near DHA Phase 5, Lahore
            </span>
          </div>

          {/* House access — understated but discoverable */}
          <div className="mt-9 flex flex-col items-center gap-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
              Staff &amp; management
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => openModal("staff")}
                className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground backdrop-blur transition-all duration-300 hover:border-ember/45 hover:text-foreground hover:shadow-[0_8px_24px_-10px_rgba(201,106,58,0.4)]"
              >
                <Lock className="size-3.5 text-ember/80" aria-hidden />
                Staff Portal
                <ArrowRight className="size-3.5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => openModal("admin")}
                className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground backdrop-blur transition-all duration-300 hover:border-gold/45 hover:text-foreground hover:shadow-[0_8px_24px_-10px_rgba(227,179,65,0.4)]"
              >
                <Lock className="size-3.5 text-gold/80" aria-hidden />
                Admin Portal
                <ArrowRight className="size-3.5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70" />
              </button>
            </div>
            <p className="max-w-xs text-center text-[0.68rem] leading-relaxed text-muted-foreground/55">
              PIN required — 01234 for both doors. A verified session stays
              unlocked on this device for 24 hours.
            </p>
          </div>

          <p className="mt-8 text-center text-[0.68rem] text-muted-foreground/45">
            © {new Date().getFullYear()} Tribe of Taste · 24/7 open buffet
          </p>
        </motion.div>
      </footer>
    </div>
  );
}

function PinModal({
  role,
  error,
  attempts,
  submitting,
  onVerify,
  onClearError,
  onClose,
}: {
  role: PINRole;
  error: string | null;
  attempts: number;
  submitting: boolean;
  onVerify: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", ""]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Fresh boxes on open and after a wrong attempt, focused and ready.
  useEffect(() => {
    setDigits(["", "", "", "", ""]);
    const timer = window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [role, attempts]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const focusIndex = (index: number) => {
    inputsRef.current[Math.max(0, Math.min(4, index))]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    onClearError();
    const next = [...digits];
    const chars = clean.slice(0, 5 - index).split("");
    for (let i = 0; i < chars.length; i++) next[index + i] = chars[i];
    setDigits(next);
    focusIndex(Math.min(index + chars.length, 4));
    if (next.every((digit) => digit !== "")) onVerify(next.join(""));
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      onClearError();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        next[index - 1] = "";
        setDigits(next);
        focusIndex(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
    }
    if (event.key === "ArrowRight" && index < 4) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const text = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 5);
    if (!text) return;
    event.preventDefault();
    onClearError();
    const next = ["", "", "", "", ""];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    focusIndex(Math.min(text.length, 4));
    if (text.length === 5) onVerify(text);
  };

  const copy =
    role === "staff"
      ? {
          icon: ChefHat,
          label: "Staff Portal",
          blurb: "Live deliveries and the reservation desk for the floor team.",
        }
      : {
          icon: ShieldCheck,
          label: "Admin Portal",
          blurb:
            "Menu and pricing control, restaurant photography and every reservation.",
        };
  const RoleIcon = copy.icon;
  const complete = digits.every((digit) => digit !== "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
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
        initial={attempts > 0 ? { x: 0 } : { scale: 0.95, opacity: 0, y: 12 }}
        animate={
          attempts > 0
            ? { x: [0, -10, 10, -6, 6, 0] }
            : { scale: 1, opacity: 1, y: 0 }
        }
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-[0_44px_90px_-30px_rgba(0,0,0,0.9)] sm:p-8"
      >
        <div className="brass-rule absolute inset-x-8 top-0 h-px" aria-hidden />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl"
        />

        <div className="relative flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/25 via-gold/10 to-transparent text-gold shadow-[0_0_28px_-8px_rgba(227,179,65,0.55)]">
            <RoleIcon className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold">
            {copy.label}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy.blurb}
          </p>
        </div>

        <form
          className="relative mt-7 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (complete) onVerify(digits.join(""));
          }}
        >
          <label
            id="portal-pin-label"
            className="text-center text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Enter the 5-digit PIN
          </label>
          <div
            className="flex justify-center gap-2 sm:gap-3"
            role="group"
            aria-labelledby="portal-pin-label"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={(event) => handlePaste(index, event)}
                onFocus={(event) => event.currentTarget.select()}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`PIN digit ${index + 1}`}
                className="size-12 rounded-xl border border-input bg-background/60 text-center font-display text-xl font-semibold text-foreground caret-gold transition-all duration-200 placeholder:text-muted-foreground/30 hover:border-gold/30 focus:border-gold/60 focus:bg-background focus:ring-2 focus:ring-gold/25 focus:outline-none sm:size-14 sm:text-2xl"
                placeholder="·"
              />
            ))}
          </div>

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
              className="flex-1 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
              disabled={!complete || submitting}
            >
              Unlock
            </Button>
          </div>
        </form>

        <p className="relative mt-6 text-center text-xs text-muted-foreground/80">
          Once verified, this device stays unlocked for 24 hours.
        </p>
      </motion.div>
    </motion.div>
  );
}
