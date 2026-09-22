import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ChefHat,
  ChevronDown,
  Clock,
  Flame,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  UserPlus,
  UtensilsCrossed,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { JanoonMark } from "@/components/tribe/JanoonMark";
import { SmartImage } from "@/components/tribe/SmartImage";
import { HearthScene } from "@/components/tribe/HearthScene";
import { Button } from "@/components/ui/button";
import {
  INCORRECT_CREDENTIALS_MESSAGE,
  NOT_ADMIN_MESSAGE,
  NOT_STAFF_MESSAGE,
  SETUP_REQUIRED_MESSAGE,
  UNCONFIGURED_MESSAGE,
  portalPathFor,
  useStaffAuth,
  type AdminSetupState,
  type OwnerSetupResult,
  type StaffRole,
} from "@/hooks/use-staff-auth";
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

/** Plain language for every way the one-time owner setup can stop short. */
function ownerSetupMessage(
  result: Extract<OwnerSetupResult, { ok: false }>,
): string {
  // Plain sentences only. Whatever the database or the sign-in service said is
  // kept out of the card and written to the console instead, where it is useful
  // for debugging and invisible to the person using it.
  switch (result.reason) {
    case "claimed":
      return "Unable to create the administrator account. An administrator already exists.";
    case "unconfigured":
    case "unknown":
      return "Unable to create the administrator account. Please try again.";
    case "weak-password":
      return "Choose a password with at least six characters.";
    case "invalid-email":
      return "That email address was not accepted. Check it and try again.";
    case "unreachable":
      return "Could not reach the sign-up service. Check your connection and try again.";
    case "existing-account":
      return "An account already exists with that email. Please sign in with your existing password. If you don't remember it, use the password reset option in the sign-in form.";
    case "email-taken":
      return "An account already exists with that email address, and that password does not match it. Sign in with the correct password, or use a different email address for the administrator.";
    case "setup-required":
      return SETUP_REQUIRED_MESSAGE;
    case "credentials":
      return "An account already exists for that email, and that password does not match it.";
    default:
      return "Unable to create the administrator account. Please try again.";
  }
}

export default function AuthLanding() {
  const navigate = useNavigate();
  const { session, isLoaded, signIn, setupOwner, canClaimOwner } =
    useStaffAuth();
  const { heroImage } = useLiveSite();
  const backdrop = heroImage ?? RESTAURANT.heroImage;

  const [searchParams, setSearchParams] = useSearchParams();
  const modalRole = searchParams.get("unlock");

  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // The admin setup, reachable only from the admin door and only while the
  // database reports that no active admin exists.
  const [ownerMode, setOwnerMode] = useState<"signin" | "setup">("signin");
  const [claim, setClaim] = useState<"checking" | AdminSetupState>("checking");
  // Bumped on every open so the effect below re-asks the database even when the
  // `?unlock=admin` parameter itself did not change — otherwise a second visit
  // to the same URL would keep a stale answer.
  const [claimCheck, setClaimCheck] = useState(0);
  const [setupPhase, setSetupPhase] = useState<"form" | "confirm">("form");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null);

  /**
   * A staff session that asked for the admin door, and may not enter it.
   *
   * The refusal is shown here, on the card the person is already looking at —
   * it is never a forward to /staff. Being moved to another screen looks like
   * the admin console had opened, when what actually happened is that it said
   * no, and it is exactly the redirect the admin door must never perform.
   */
  const staffAtAdminDoor =
    modalRole === "admin" && !!session && !session.roles.includes("admin");

  // A live session goes straight to its portal — no re-entry. The refusal
  // above is the one exception: it stays put and says so.
  useEffect(() => {
    if (!isLoaded || !session || staffAtAdminDoor) return;
    navigate(portalPathFor(session.role, session.roles), { replace: true });
  }, [isLoaded, session, staffAtAdminDoor, navigate]);

  /**
   * Asked of the database each time the admin door opens. A signed-out visitor
   * cannot read `staff_members` at all, so the answer arrives as one boolean —
   * and it is the database, not this page, that decides whether setup is still
   * available.
   */
  useEffect(() => {
    if (modalRole !== "admin") return;
    let active = true;
    void canClaimOwner().then((state) => {
      if (active) setClaim(state);
    });
    return () => {
      active = false;
    };
  }, [modalRole, claimCheck, canClaimOwner]);

  const resetOwnerFlow = () => {
    setOwnerMode("signin");
    setSetupPhase("form");
    setSetupError(null);
  };

  const openModal = (role: StaffRole) => {
    setError(null);
    resetOwnerFlow();
    // Back to "checking" here rather than in the effect: an effect that sets
    // state on its way to an async read is the cascading render React warns
    // about. This is an event, so the reset belongs with it — and the nonce
    // guarantees the effect runs again even if the URL parameter is unchanged.
    setClaim("checking");
    setClaimCheck((count) => count + 1);
    setSearchParams({ unlock: role }, { replace: true });
  };

  const closeModal = () => {
    setSearchParams({}, { replace: true });
    setError(null);
    resetOwnerFlow();
  };

  const handleSignIn = async (email: string, password: string) => {
    const role = modalRole;
    if (role !== "staff" && role !== "admin") return;
    setSubmitting(true);
    // The door decides which role the account must hold. Signing in at the
    // admin door with a staff account is a refusal, never a forwarding to
    // /staff: an unasked-for redirect reads as "the admin console opened".
    const result = await signIn(email, password, role);
    if (result.ok) {
      // Entered through the staff door → the staff desk. Entered through the
      // admin door → /admin, which only an admin reaches at all.
      if (role === "staff") {
        navigate("/staff", { replace: true });
      } else {
        navigate(portalPathFor(result.role, result.roles), { replace: true });
      }
      return;
    }
    setAttempts((count) => count + 1);
    setError(
      result.reason === "not-admin"
        ? NOT_ADMIN_MESSAGE
        : result.reason === "not-staff"
          ? // While the owner claim is still open, the person most likely to hit
            // this is the owner themselves — signed up, but not yet recorded.
            claim !== "closed" && claim !== "checking"
            ? "That account is not on the team yet. If it is yours, open Create Admin Account above to claim it."
            : NOT_STAFF_MESSAGE
          : result.reason === "unconfigured"
            ? UNCONFIGURED_MESSAGE
            : result.reason === "unreachable"
              ? "Could not reach the sign-in service. Check your connection and try again."
              : INCORRECT_CREDENTIALS_MESSAGE,
    );
    setSubmitting(false);
  };

  /**
   * Create the owner account. Auth user first, role second — and both from the
   * website, so there is no dashboard step and no service key in the bundle.
   */
  const handleOwnerSetup = async (email: string, password: string) => {
    setSetupSubmitting(true);
    setSetupError(null);
    const result = await setupOwner(email, password);
    if (result.ok) {
      navigate("/admin", { replace: true });
      return;
    }
    setSetupSubmitting(false);
    // When the email already exists in Auth, admin has been granted
    // server-side via claim_admin_for_email. Show a SUCCESS message (not an
    // error) and switch to the sign-in form so the user can sign in with
    // their existing password.
    if (result.reason === "existing-account") {
      setOwnerMode("signin");
      setSetupPhase("form");
      // The claim has just been spent on that account, so the setup action is
      // gone the moment it succeeded — no round trip needed to hide it.
      setClaim("closed");
      setSetupSuccess(ownerSetupMessage(result));
      return;
    }
    if (result.reason === "confirm-email") {
      // Not a failure — this project asks new accounts to confirm their address
      // first. The credentials are still on screen, so Continue finishes it.
      setSetupPhase("confirm");
      return;
    }
    setSetupError(ownerSetupMessage(result));
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {modalRole ? (
        <SignInModal
          role={modalRole as StaffRole}
          error={error ?? (staffAtAdminDoor ? NOT_ADMIN_MESSAGE : null)}
          shake={attempts}
          submitting={submitting}
          onSignIn={(email, password) => void handleSignIn(email, password)}
          onClearError={() => {
            setError(null);
            setSetupError(null);
            setSetupSuccess(null);
          }}
          onClose={closeModal}
          owner={{
            claim,
            mode: ownerMode,
            phase: setupPhase,
            error: setupError,
            successMessage: setupSuccess,
            submitting: setupSubmitting,
            onSelect: (mode) => {
              setOwnerMode(mode);
              setSetupPhase("form");
              setSetupError(null);
              setSetupSuccess(null);
            },
            onSubmit: (email, password) =>
              void handleOwnerSetup(email, password),
          }}
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
              <JanoonMark className="size-9" />
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.24em] text-foreground/80">
                Lahore · Gulberg
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
            Open-air terrace · Gulberg, Lahore
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="mt-6 font-display text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            <span className="bg-gradient-to-r from-gold via-gold to-ember bg-clip-text text-transparent">
              JUNOON
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
              Gulberg · Lahore, Pakistan
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
              Staff and management access. The first account set up here becomes
              the administrator.
            </p>
          </div>

          <p className="mt-8 text-center text-[0.68rem] text-muted-foreground/45">
            © {new Date().getFullYear()} JUNOON · Pakistani Restaurant
          </p>
        </motion.div>
      </footer>
    </div>
  );
}

/**
 * Sign-in for the two portals, on Supabase Auth.
 *
 * This card used to be a five-digit keypad whose code lived in the JavaScript
 * bundle, unlocked by a localStorage flag. A keypad that anyone can read the
 * code to is not a lock, so it is a real credential now — and the role that
 * decides what the account may touch is read from the database, not the page.
 */
function SignInModal({
  role,
  error,
  shake,
  submitting,
  onSignIn,
  onClearError,
  onClose,
  owner,
}: {
  role: StaffRole;
  error: string | null;
  /** Bumped on a failed attempt so the card can shake again. */
  shake: number;
  submitting: boolean;
  onSignIn: (email: string, password: string) => void;
  onClearError: () => void;
  onClose: () => void;
  /** The one-time owner setup, driven by the page that owns the auth state. */
  owner: {
    /**
     * `open` only while the database holds no active admin; `checking` until it
     * has answered, and `unknown` if the check could not run.
     */
    claim: "checking" | AdminSetupState;
    mode: "signin" | "setup";
    phase: "form" | "confirm";
    error: string | null;
    successMessage: string | null;
    submitting: boolean;
    onSelect: (mode: "signin" | "setup") => void;
    onSubmit: (email: string, password: string) => void;
  };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const emailRef = useRef<HTMLInputElement | null>(null);
  const settingUp = owner.mode === "setup";
  const confirming = settingUp && owner.phase === "confirm";
  const busy = submitting || (settingUp && owner.submitting);
  const shownError = settingUp ? owner.error : error;
  // Admin recovery, offered only while the database has not told us an
  // administrator already exists.
  const offersSetup =
    role === "admin" &&
    !settingUp &&
    owner.claim !== "closed" &&
    owner.claim !== "checking";

  // Ready to type the moment the card opens, and again when the setup tab is
  // chosen.
  useEffect(() => {
    const timer = window.setTimeout(() => emailRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [role, owner.mode]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const copy = settingUp
    ? {
        icon: UserPlus,
        label: "Create Admin Account",
        blurb: "Set up the administrator account for this restaurant.",
      }
    : role === "staff"
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
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const complete = settingUp
    ? email.trim().length > 3 && password.length >= 6 && passwordsMatch
    : email.trim().length > 3 && password.length > 0;
  const inputClass =
    "h-11 w-full rounded-xl border border-input bg-background/60 px-3.5 text-sm text-foreground caret-gold transition-all duration-200 placeholder:text-muted-foreground/40 hover:border-gold/30 focus:border-gold/60 focus:bg-background focus:ring-2 focus:ring-gold/25 focus:outline-none";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.label} sign-in`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        key={shake}
        initial={shake > 0 ? { x: 0 } : { scale: 0.95, opacity: 0, y: 12 }}
        animate={
          shake > 0
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

        {/*
          Admin recovery. The database decides whether this restaurant already
          has an administrator; this block only presents that answer. The action
          is visible whenever setup is possible, and gone the moment one exists.
        */}
        {role === "admin" && (offersSetup || settingUp) ? (
          <div className="relative mt-6 flex flex-col gap-3">
            {/*
              `outdated` — the database answered without the current rule's
              marker, so it can say whether an admin is wanted but cannot record
              one. The action is still offered, because the claim itself is
              decided in the database: it either grants the role or refuses it.
              Nothing here tells the owner to run anything by hand.
            */}
            {offersSetup ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => owner.onSelect("setup")}
                className="h-11 w-full gap-2 border-gold/30 bg-background/40 hover:border-gold/50 hover:bg-secondary/60"
              >
                <UserPlus className="size-4 text-gold" aria-hidden />
                Create Admin Account
              </Button>
            ) : null}

            {offersSetup ? (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Set up the administrator account for this restaurant.
              </p>
            ) : null}

            {offersSetup ? (
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-border/70" />
                <span className="text-[0.65rem] tracking-[0.2em] text-muted-foreground/60 uppercase">
                  or
                </span>
                <span className="h-px flex-1 bg-border/70" />
              </div>
            ) : null}

            {settingUp ? (
              <button
                type="button"
                onClick={() => owner.onSelect("signin")}
                className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to admin sign-in
              </button>
            ) : null}

          </div>
        ) : null}

        {confirming ? (
          <div className="relative mt-7 flex flex-col gap-4 text-center">
            <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gold">
              <Mail className="size-4" aria-hidden />
              Confirm your email
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="text-foreground">{email.trim()}</span>. Open it,
              then press Continue — the admin account is recorded the moment the
              address is confirmed.
            </p>

            {owner.error ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {owner.error}
              </motion.p>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => owner.onSelect("setup")}
              >
                Use a different email
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
                disabled={owner.submitting}
                onClick={() => owner.onSubmit(email, password)}
              >
                {owner.submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Continue
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground/70">
              Nothing in your inbox? Check the spam folder. The setup stays open
              until the first account claims it.
            </p>
          </div>
        ) : (
        <form
          className="relative mt-7 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete) return;
            if (settingUp) owner.onSubmit(email, password);
            else onSignIn(email, password);
          }}
        >
          <div className="flex flex-col gap-2 text-left">
            <label
              htmlFor="portal-email"
              className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              {settingUp || role === "admin" ? "Admin email" : "Staff email"}
            </label>
            <input
              id="portal-email"
              ref={emailRef}
              type="email"
              name="email"
              value={email}
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                onClearError();
                setEmail(event.target.value);
              }}
              className={inputClass}
              placeholder="owner@janoon.pk"
            />
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label
              htmlFor="portal-password"
              className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            >
              Password
            </label>
            <input
              id="portal-password"
              type="password"
              name="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => {
                onClearError();
                setPassword(event.target.value);
              }}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {settingUp ? (
            <div className="flex flex-col gap-2 text-left">
              <label
                htmlFor="portal-password-confirm"
                className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Confirm password
              </label>
              <input
                id="portal-password-confirm"
                type="password"
                name="password-confirm"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(event) => {
                  onClearError();
                  setConfirmPassword(event.target.value);
                }}
                className={inputClass}
                placeholder="Repeat the password"
              />
              {password.length > 0 && !passwordsMatch ? (
                <p className="text-xs text-muted-foreground">
                  Both passwords have to match.
                </p>
              ) : null}
            </div>
          ) : null}

          {shownError ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
              role="alert"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {shownError}
            </motion.p>
          ) : null}

          {!settingUp && owner.successMessage ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300"
              role="status"
            >
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              {owner.successMessage}
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
              className="flex-1 gap-2 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
              disabled={!complete || busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {settingUp ? "Create admin account" : "Unlock"}
            </Button>
          </div>
        </form>
        )}

        <p className="relative mt-6 text-center text-xs text-muted-foreground/80">
          {settingUp
            ? "You are signed in as the administrator as soon as setup finishes."
            : "Accounts are issued by the administrator. You stay signed in on this device until you sign out."}
        </p>
      </motion.div>
    </motion.div>
  );
}
