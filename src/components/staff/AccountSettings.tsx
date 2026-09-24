import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStaffAuth } from "@/hooks/use-staff-auth";
import {
  changeOwnEmail,
  changeOwnPassword,
  syncOwnStaffEmail,
} from "@/lib/staff";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Sign-in credentials, for whoever is signed in — owner or floor team.
 *
 * What this panel cannot do is the important part. It cannot change a role, and
 * it does not try: the role lives in `staff_members` and is only ever written by
 * an admin through the Team screen. Changing an email or a password here moves
 * the sign-in details and nothing else, so a staff account that changes its
 * password stays exactly as staff as it was.
 *
 * Both forms re-ask for the current password first. That is the re-authentication
 * step Supabase wants before a credential change, and it also means an unlocked
 * laptop cannot be used to lock the real account out.
 */
export function AccountSettings() {
  const { session } = useStaffAuth();

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDone, setEmailDone] = useState<string | null>(null);
  const [emailConfirming, setEmailConfirming] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [pwConfirming, setPwConfirming] = useState(false);

  // The team list should never show yesterday's address: if an email change was
  // confirmed since the last visit, catch the row up here.
  useEffect(() => {
    void syncOwnStaffEmail();
  }, []);

  const submitEmail = async () => {
    setEmailBusy(true);
    setEmailError(null);
    setEmailDone(null);
    try {
      const result = await changeOwnEmail(emailPassword, newEmail);
      setEmailConfirming(false);
      setEmailPassword("");
      setNewEmail("");
      setEmailDone(
        result.confirmationRequired
          ? `Check ${result.address} for the confirmation link — the new address becomes your sign-in once it is opened.`
          : `Your sign-in address is now ${result.address}. Your role is unchanged.`,
      );
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "Could not change your email.",
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const submitPassword = async () => {
    setPwBusy(true);
    setPwError(null);
    setPwDone(false);
    try {
      await changeOwnPassword(currentPassword, nextPassword);
      setPwConfirming(false);
      setCurrentPassword("");
      setNextPassword("");
      setRepeatPassword("");
      setPwDone(true);
    } catch (error) {
      setPwError(
        error instanceof Error
          ? error.message
          : "Could not change your password.",
      );
    } finally {
      setPwBusy(false);
    }
  };

  const emailReady =
    newEmail.trim().length > 3 &&
    newEmail.includes("@") &&
    emailPassword.length > 0;
  const passwordReady =
    currentPassword.length > 0 &&
    nextPassword.length >= 8 &&
    nextPassword === repeatPassword;

  // Same field treatment as the sign-in card, so the account screen reads as
  // part of the same product.
  const inputClass =
    "h-11 w-full rounded-xl border border-input bg-background/60 px-3.5 text-sm text-foreground caret-gold transition-all duration-200 placeholder:text-muted-foreground/40 hover:border-gold/30 focus:border-gold/60 focus:bg-background focus:ring-2 focus:ring-gold/25 focus:outline-none";

  return (
    <section>
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <ShieldCheck className="size-5 text-gold" aria-hidden />
          Your account
        </h2>
        <p className="text-sm text-muted-foreground">
          Change the email or password you sign in with. Your{" "}
          <span className="text-gold">{(session?.roles ?? [session?.role ?? "team"]).join(", ")}</span> access
          stays exactly as it is — this page cannot change a role, and no one can
          read your password, including the owner.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* ————— Email ————— */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              <Mail className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold">
                Sign-in email
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Currently {session?.email ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-new-email" className="text-xs">
              New email
            </Label>
            <Input
              id="account-new-email"
              type="email"
              value={newEmail}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              placeholder="name@janoon.pk"
              className={inputClass}
              onChange={(event) => {
                setEmailError(null);
                setEmailDone(null);
                setNewEmail(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-email-password" className="text-xs">
              Your current password
            </Label>
            <Input
              id="account-email-password"
              type="password"
              value={emailPassword}
              autoComplete="current-password"
              className={inputClass}
              onChange={(event) => {
                setEmailError(null);
                setEmailDone(null);
                setEmailPassword(event.target.value);
              }}
            />
          </div>

          <Feedback error={emailError} />

          {emailDone ? (
            <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold">
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {emailDone}
            </p>
          ) : null}

          {emailConfirming ? (
            <ConfirmRow
              question={`Use ${newEmail.trim()} as your sign-in address?`}
              busy={emailBusy}
              onCancel={() => setEmailConfirming(false)}
              onConfirm={() => void submitEmail()}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-fit gap-2"
              disabled={!emailReady || emailBusy}
              onClick={() => setEmailConfirming(true)}
            >
              {emailBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Update email
            </Button>
          )}
        </div>

        {/* ————— Password ————— */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ember/30 bg-ember/10 text-ember">
              <KeyRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold">Password</p>
              <p className="text-xs text-muted-foreground">
                At least 8 characters. Stored only as a hash by Supabase Auth.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-current-password" className="text-xs">
              Current password
            </Label>
            <Input
              id="account-current-password"
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              className={inputClass}
              onChange={(event) => {
                setPwError(null);
                setPwDone(false);
                setCurrentPassword(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-next-password" className="text-xs">
                New password
              </Label>
              <Input
                id="account-next-password"
                type="password"
                value={nextPassword}
                autoComplete="new-password"
                className={inputClass}
                onChange={(event) => {
                  setPwError(null);
                  setPwDone(false);
                  setNextPassword(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-repeat-password" className="text-xs">
                Repeat it
              </Label>
              <Input
                id="account-repeat-password"
                type="password"
                value={repeatPassword}
                autoComplete="new-password"
                className={inputClass}
                onChange={(event) => {
                  setPwError(null);
                  setPwDone(false);
                  setRepeatPassword(event.target.value);
                }}
              />
            </div>
          </div>

          {repeatPassword.length > 0 && nextPassword !== repeatPassword ? (
            <p className="text-xs text-muted-foreground">
              Both passwords have to match.
            </p>
          ) : null}

          <Feedback error={pwError} />

          {pwDone ? (
            <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold">
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Password changed. You stay signed in on this device, and your role
              is unchanged.
            </p>
          ) : null}

          {pwConfirming ? (
            <ConfirmRow
              question="Change your password now?"
              busy={pwBusy}
              onCancel={() => setPwConfirming(false)}
              onConfirm={() => void submitPassword()}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-fit gap-2"
              disabled={!passwordReady || pwBusy}
              onClick={() => setPwConfirming(true)}
            >
              {pwBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Change password
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** A one-line error, in the same red the sign-in card uses. */
function Feedback({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {error}
    </motion.p>
  );
}

/** The "are you sure" step both forms pass through before they run. */
function ConfirmRow({
  question,
  busy,
  onCancel,
  onConfirm,
}: {
  question: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-3"
    >
      <p className="text-xs leading-relaxed text-foreground/90">{question}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onCancel}
        >
          <X className="size-3.5" aria-hidden />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
          Confirm
        </Button>
      </div>
    </motion.div>
  );
}
