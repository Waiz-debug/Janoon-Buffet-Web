import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { AlertCircle, Check, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

/**
 * Where a password-recovery link lands: `/update-password`.
 *
 * **This page is what was missing.** A reset link used to deliver the member to
 * the site with a session in the URL and nothing that could act on it, so the
 * link "did not work" however correctly it pointed. Two shapes arrive, and both
 * are handled here:
 *
 *   • `#access_token=…&refresh_token=…&type=recovery` — the implicit flow, which
 *     supabase-js usually consumes by itself on load;
 *   • `?code=…` — the PKCE flow, which has to be exchanged for a session.
 *
 * Either way the result is the same: a real session, a form, and
 * `updateUser({ password })`. Nothing else in the app can set a password for
 * somebody who is not signed in, so this is the only place the update can
 * happen.
 *
 * The address is read from the running page, never hard-coded, so a link sent
 * from a preview origin and opened on the live site — or the reverse — still
 * arrives somewhere real. See `recoveryRedirect()` in `src/lib/redirects.ts`.
 */
type Phase =
  | "checking"
  | "ready"
  | "working"
  | "done"
  | "expired"
  | "failed";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /**
   * Turn whatever the link carried into a session.
   *
   * Runs once on mount, and tolerates the client having already handled the
   * link itself: an existing session is used as-is, and only a bare code is
   * exchanged. `code` is cleaned out of the URL afterwards so a refresh cannot
   * replay an already-spent code and report a false failure.
   */
  useEffect(() => {
    let cancelled = false;

    const establish = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionData.session) {
          setPhase("ready");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (!code) {
          setPhase("expired");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setPhase("expired");
          return;
        }
        params.delete("code");
        const rest = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${rest ? `?${rest}` : ""}`,
        );
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("failed");
      }
    };

    void establish();
    return () => {
      cancelled = true;
    };
  }, []);

  const problem =
    password.length > 0 && password.length < 8
      ? "Use at least 8 characters."
      : confirmPassword.length > 0 && password !== confirmPassword
        ? "Both passwords have to match."
        : null;

  const submit = async () => {
    if (password.length < 8) {
      setMessage("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Both passwords have to match.");
      return;
    }
    setPhase("working");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(
        error.message.split("\n")[0] ??
          "The password could not be changed. Ask an admin for a new link.",
      );
      setPhase("ready");
      return;
    }
    setPhase("done");
    // The session that came with the link has done its job. Closing it means a
    // shared device is not left holding a recovery session.
    await supabase.auth.signOut().catch(() => undefined);
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-input bg-background/60 px-3.5 text-sm text-foreground caret-gold transition-all duration-200 placeholder:text-muted-foreground/40 hover:border-gold/30 focus:border-gold/60 focus:bg-background focus:ring-2 focus:ring-gold/25 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8"
      >
        <span className="flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold">
          Choose a new password
        </h1>

        {phase === "checking" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking your link…
          </p>
        ) : null}

        {phase === "expired" ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              This link has expired or was already used. Ask whoever manages the
              site for a new one — from the Team screen it is “Send setup link”.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => navigate("/")}
            >
              Back to Junoon
            </Button>
          </div>
        ) : null}

        {phase === "ready" || phase === "working" ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="recover-password" className="text-xs">
                New password
              </Label>
              <Input
                id="recover-password"
                type="password"
                value={password}
                autoComplete="new-password"
                autoFocus
                className={inputClass}
                onChange={(event) => {
                  setMessage(null);
                  setPassword(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recover-repeat" className="text-xs">
                Repeat it
              </Label>
              <Input
                id="recover-repeat"
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                className={inputClass}
                onChange={(event) => {
                  setMessage(null);
                  setConfirmPassword(event.target.value);
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              At least 8 characters. Your role on the team is not affected.
            </p>
            {problem ? (
              <p className="text-xs text-muted-foreground">{problem}</p>
            ) : null}
            {message ? (
              <p
                className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300"
                role="alert"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {message}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={phase === "working"}
            >
              {phase === "working" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Save the new password
            </Button>
          </form>
        ) : null}

        {phase === "done" ? (
          <div className="mt-3 flex flex-col gap-3">
            <p
              className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-gold"
              role="status"
            >
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              Password changed. Sign in with it on the staff or admin door — your
              role is exactly as it was.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate("/dashboard")}>
                Staff sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
              >
                Back to Junoon
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "failed" ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Something went wrong opening that link.{" "}
            <Link to="/" className="underline underline-offset-4">
              Back to Junoon
            </Link>
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
