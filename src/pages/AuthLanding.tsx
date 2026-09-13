import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ChefHat,
  Clock,
  Flame,
  Lock,
  MapPin,
  PanelRight,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  portalPathFor,
  usePinSession,
  type PINRole,
} from "@/hooks/use-pin-auth";

type RoleCard = {
  id: "user" | "staff" | "admin";
  eyebrow: string;
  label: string;
  description: string;
  cta: string;
  footnote: string;
  icon: typeof Users;
  pin: boolean;
  tone: keyof typeof TONES;
};

const TONES = {
  gold: {
    iconWrap:
      "border-gold/35 bg-gradient-to-br from-gold/25 via-gold/10 to-transparent text-gold shadow-[0_0_32px_-10px_rgba(227,179,65,0.55)]",
    cardHover:
      "hover:border-gold/40 hover:shadow-[0_28px_64px_-28px_rgba(227,179,65,0.32)]",
    hairline: "via-gold/60",
    glow: "bg-gold/10",
    cta: "border-gold/35 bg-gold/10 text-gold hover:border-gold/60 hover:bg-gold/15",
    watermark: "text-gold/[0.045] group-hover:text-gold/[0.09]",
  },
  ember: {
    iconWrap:
      "border-ember/35 bg-gradient-to-br from-ember/25 via-ember/10 to-transparent text-ember shadow-[0_0_32px_-10px_rgba(201,106,58,0.55)]",
    cardHover:
      "hover:border-ember/40 hover:shadow-[0_28px_64px_-28px_rgba(201,106,58,0.32)]",
    hairline: "via-ember/60",
    glow: "bg-ember/10",
    cta: "border-ember/35 bg-ember/10 text-ember hover:border-ember/60 hover:bg-ember/15",
    watermark: "text-ember/[0.045] group-hover:text-ember/[0.09]",
  },
  brass: {
    iconWrap:
      "border-ember/40 bg-gradient-to-br from-gold/25 via-ember/15 to-transparent text-gold shadow-[0_0_32px_-10px_rgba(227,179,65,0.55)]",
    cardHover:
      "hover:border-gold/45 hover:shadow-[0_28px_64px_-28px_rgba(227,179,65,0.34)]",
    hairline: "via-gold/50",
    glow: "bg-gold/10",
    cta: "border-gold/35 bg-gradient-to-r from-gold/15 to-ember/10 text-gold hover:border-gold/60 hover:from-gold/25 hover:to-ember/15",
    watermark: "text-gold/[0.045] group-hover:text-gold/[0.09]",
  },
} as const;

const ROLE_CARDS: RoleCard[] = [
  {
    id: "user",
    eyebrow: "Dining room · Open access",
    label: "User",
    description:
      "Browse the full menu, check the buffet tiers, order delivery and book a table — everything a guest needs, no sign-in.",
    cta: "Enter as guest",
    footnote: "No account needed",
    icon: Users,
    pin: false,
    tone: "gold",
  },
  {
    id: "staff",
    eyebrow: "Floor & delivery operations",
    label: "Staff",
    description:
      "Live delivery orders with customer details, itemised bills and one-tap status updates for the team on the floor.",
    cta: "Open Staff Portal",
    footnote: "5-digit PIN · 24-hour session",
    icon: PanelRight,
    pin: true,
    tone: "ember",
  },
  {
    id: "admin",
    eyebrow: "Menu, pricing & media",
    label: "Admin",
    description:
      "Edit dishes and prices in real time, upload authentic restaurant photography and manage every reservation.",
    cta: "Open Admin Portal",
    footnote: "5-digit PIN · 24-hour session",
    icon: ShieldCheck,
    pin: true,
    tone: "brass",
  },
];

export default function AuthLanding() {
  const navigate = useNavigate();
  const { session, isLoaded, verify } = usePinSession();

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
      {/* Warm hearth backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 hearth-glow" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_45%,rgba(0,0,0,0.4)_100%)]"
        />
        <HeroAmbience />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b border-border/60 bg-background/60 px-4 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gradient-to-br from-gold/25 via-gold/10 to-transparent text-gold shadow-[0_0_28px_-8px_rgba(227,179,65,0.6)]">
              <Flame className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-tight">
                Tribe of Taste
              </p>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-gold/75">
                Lahore · Open 24 hours
              </p>
            </div>
          </div>
          <Link
            to="/restaurant"
            className="group inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Restaurant site
            <ArrowRight
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-14 sm:px-6 sm:py-20">
        <div className="w-full max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="mb-12 text-center sm:mb-14"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-gold">
              <Lock className="size-3" aria-hidden />
              Secure access
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              One hearth, <span className="text-gold">three doors.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Guests walk straight into the dining room — no account needed.
              Staff and management enter through their own PIN-protected doors,
              unlocked once and remembered for 24 hours.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
            {ROLE_CARDS.map((card, index) => {
              const Icon = card.icon;
              const tone = TONES[card.tone];
              return (
                <motion.article
                  key={card.id}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.12 + index * 0.1,
                    ease: "easeOut",
                  }}
                  whileHover={{ y: -6 }}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 hover:bg-card/90 ${tone.cardHover}`}
                >
                  {/* Hairline that lights up on hover */}
                  <div
                    aria-hidden
                    className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${tone.hairline}`}
                  />
                  {/* Warm glow pooling in the corner */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -right-14 -top-14 size-36 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${tone.glow}`}
                  />
                  {/* Oversized watermark icon */}
                  <Icon
                    aria-hidden
                    className={`pointer-events-none absolute -bottom-7 -right-6 size-28 transition-all duration-500 group-hover:scale-110 ${tone.watermark}`}
                  />
                  <span className="absolute right-5 top-5 font-display text-xs tracking-[0.3em] text-muted-foreground/40">
                    0{index + 1}
                  </span>

                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${tone.iconWrap}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>

                  <div className="relative mt-5 flex-1">
                    <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                      {card.eyebrow}
                    </p>
                    <h2 className="mt-1.5 font-display text-xl font-semibold">
                      {card.label}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                  </div>

                  <div className="relative mt-6 flex flex-col gap-2.5">
                    {card.pin ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={`group/cta w-full gap-2 ${tone.cta}`}
                        onClick={() => openModal(card.id as PINRole)}
                      >
                        <Lock className="size-3.5" aria-hidden />
                        {card.cta}
                        <ArrowRight className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="lg"
                        className="group/cta w-full gap-2 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground shadow-lg shadow-black/30 transition-shadow duration-300 hover:shadow-[0_14px_36px_-12px_rgba(227,179,65,0.45)]"
                      >
                        <Link to="/restaurant">
                          {card.cta}
                          <ArrowRight className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                        </Link>
                      </Button>
                    )}
                    <p className="text-center text-[0.7rem] text-muted-foreground/80">
                      {card.footnote}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-12 flex flex-col items-center gap-5 sm:mt-14"
          >
            <div className="brass-rule h-px w-44" aria-hidden />
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-xs text-muted-foreground/85">
              <span className="inline-flex items-center gap-2">
                <Clock className="size-3.5 text-gold/70" aria-hidden />
                Open 24 hours
              </span>
              <a
                href="tel:+923228543333"
                className="inline-flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Phone className="size-3.5 text-gold/70" aria-hidden />
                0322 8543333
              </a>
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-3.5 text-gold/70" aria-hidden />
                Natha Singh Wala · near DHA Phase 5, Lahore
              </span>
            </div>
            <p className="max-w-md text-center text-[0.7rem] leading-relaxed text-muted-foreground/60">
              Staff and admin share the PIN 01234. A verified session stays
              unlocked on this device for 24 hours.
            </p>
          </motion.div>
        </div>
      </main>

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
          blurb:
            "Live deliveries and the reservation desk for the floor team.",
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
        initial={
          attempts > 0
            ? { x: 0 }
            : { scale: 0.95, opacity: 0, y: 12 }
        }
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

function HeroAmbience() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 h-[55vh] overflow-hidden"
      style={{
        maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
      }}
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
