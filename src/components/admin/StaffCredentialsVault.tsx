import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmStaffEmail,
  isMissingFunction,
  listStaff,
  sendPasswordReset,
  verifyStaffSignIn,
  type SignInCheck,
  type StaffMember,
} from "@/lib/staff";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Staff credentials — the admin-only reference and recovery console.
 *
 * What this screen deliberately does **not** do is list passwords. Supabase Auth
 * keeps a one-way bcrypt hash and hands the plaintext back to nobody, so there
 * is no version of this screen that could show a member's existing password: the
 * data does not exist to be displayed. A list that appeared to hold them would
 * be showing invented numbers, and a store of them kept in the browser would be
 * *less* safe than the hash it replaced — readable from the desk, from browser
 * profiles and backups, and by any script on the page.
 *
 * So it carries the three things that are real and that actually unblock a
 * locked-out member:
 *
 *   • the sign-in address, on every row, one click to copy;
 *   • a live **Verify** that tests a password against Supabase Auth and reports
 *     Auth's own reason for refusing — "wrong password", "address never
 *     confirmed", "too many attempts" — instead of a generic failure;
 *   • a **setup link**, the one and only way to give someone a known password.
 *
 * The password an owner chooses while creating an account is shown once, in the
 * Team tab's handover card, because that is the only moment the plaintext exists
 * anywhere at all.
 */
export function StaffCredentialsVault() {
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await listStaff();
      setMembers(rows);
      setError(null);
      setSyncedAt(new Date().toLocaleTimeString());
    } catch (caught) {
      setMembers([]);
      setError(
        isMissingFunction(caught)
          ? "The team functions are not on this project yet — run supabase/schema.sql, then press Refresh."
          : caught instanceof Error
            ? caught.message
            : "Could not load the team.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <ShieldCheck className="size-5 text-gold" aria-hidden />
          Staff credentials
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Every team member&apos;s sign-in address, in one place, with a way to
          test a password before a member stands at the till and a way to give
          them a new one. Passwords themselves are not shown: Supabase Auth
          stores a one-way hash, so they cannot be read back by this screen or
          by anyone else — including the owner.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {members ? `${members.length} account${members.length === 1 ? "" : "s"}` : "—"}
          {syncedAt ? ` · synced ${syncedAt}` : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {busy ? "Syncing…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <p
          className="flex items-start gap-2 rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-200"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {members === null ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading the team…
        </p>
      ) : members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          No team accounts yet. Add one from the Team tab.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <CredentialsRow key={member.userId} member={member} />
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        If a member cannot get in, the answer is always the same and always
        works: <span className="text-gold">Send setup link</span>. It emails a
        one-time link, the member chooses their own password from it, and the
        role on the account is untouched. There is no faster route, and no route
        that involves recovering the old one.
      </p>
    </section>
  );
}

/** One member: the address, and the two things that actually help. */
function CredentialsRow({ member }: { member: StaffMember }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<SignInCheck | null>(null);

  const address = member.email ?? "";

  const confirm = async () => {
    setConfirming(true);
    setNote(null);
    try {
      const changed = await confirmStaffEmail(address);
      setNote(
        changed
          ? `${address} is confirmed. The member can sign in now, with the password they were given.`
          : `${address} was already confirmed — nothing to change.`,
      );
      toast.success(
        changed ? "Address confirmed" : "Already confirmed",
        { description: address },
      );
    } catch (error) {
      const detail = isMissingFunction(error)
        ? "This project has not been patched yet — run supabase/fix-admin-recovery.sql."
        : error instanceof Error
          ? error.message
          : "Try again in a moment.";
      setNote(detail);
      toast.error("Could not confirm the address", { description: detail });
    } finally {
      setConfirming(false);
    }
  };

  const verify = async () => {
    setChecking(true);
    setResult(null);
    try {
      const outcome = await verifyStaffSignIn(address, password);
      setResult(outcome);
      if (outcome.ok) {
        toast.success(`${address} can sign in with that password`);
        setPassword("");
        setOpen(false);
      }
    } catch (error) {
      setResult({
        ok: false,
        reason:
          error instanceof Error ? error.message : "The check could not run.",
      });
    } finally {
      setChecking(false);
    }
  };

  const sendLink = async () => {
    setSending(true);
    try {
      await sendPasswordReset(address);
      toast.success("Setup link sent", {
        description: `${address} chooses their own password from it.`,
      });
    } catch (error) {
      toast.error("Could not send the link", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
        duration: 8000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={
              member.role === "admin"
                ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold"
                : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-muted-foreground"
            }
          >
            <Mail className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{address || "—"}</span>
              {address ? <CopyButton value={address} /> : null}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {note ? (
                <span className="w-full leading-relaxed text-gold/90">{note}</span>
              ) : null}
              {(member.roles.length > 0 ? member.roles : [member.role]).map((r) => (
                <span
                  key={r}
                  className={
                    r === "admin"
                      ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-gold"
                      : "rounded-full border border-border/70 px-2 py-0.5"
                  }
                >
                  {r}
                </span>
              ))}
              <span
                className={
                  member.active
                    ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-gold"
                    : "rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300"
                }
              >
                {member.active ? "active" : "suspended"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!address}
            onClick={() => {
              setOpen((value) => !value);
              setResult(null);
            }}
          >
            <KeyRound className="size-3.5" aria-hidden />
            Verify
          </Button>
          {/* The cure for the failure `Verify` reports as "address never
              confirmed": an admin-gated function stamps the confirmation, so
              the account signs in without anyone waiting on a mail. Offered on
              every row because an account created before this existed — or
              before this project was patched — may still need it. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!address || confirming}
            title="Mark this address as confirmed so the member can sign in"
            onClick={() => void confirm()}
          >
            {confirming ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ShieldCheck className="size-3.5" aria-hidden />
            )}
            Confirm address
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!address || sending}
            onClick={() => void sendLink()}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-3.5" aria-hidden />
            )}
            Send setup link
          </Button>
        </div>
      </div>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor={`verify-${member.userId}`}
                className="text-[0.65rem] tracking-[0.18em] text-gold/80 uppercase"
              >
                Test this password
              </label>
              <Input
                id={`verify-${member.userId}`}
                type="password"
                value={password}
                autoComplete="off"
                placeholder="Type the password you gave them"
                className="h-10 rounded-xl bg-background/60"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && password) void verify();
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-10 gap-1.5"
              disabled={!password || checking}
              onClick={() => void verify()}
            >
              {checking ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              Test sign-in
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={() => {
                setOpen(false);
                setResult(null);
                setPassword("");
              }}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>

          {result && !result.ok ? (
            <p
              className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {result.reason}
            </p>
          ) : null}
          {result && result.ok ? (
            <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold">
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              That sign-in works. Nothing was changed and no session was kept.
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </li>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      title={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => {
            toast.error("Could not copy", {
              description: "Select the text and copy it by hand.",
            });
          });
      }}
      className="inline-flex shrink-0 cursor-pointer items-center rounded-lg border border-gold/30 p-1 text-gold transition-colors hover:bg-gold/15"
    >
      {copied ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <Copy className="size-3" aria-hidden />
      )}
    </button>
  );
}
