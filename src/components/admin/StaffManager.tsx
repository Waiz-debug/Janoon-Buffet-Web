import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffRole } from "@/hooks/use-staff-auth";
import {
  addStaffAccount,
  deleteStaffAccount,
  grantRole,
  isMissingFunction,
  listStaff,
  removeRole,
  removeStaff,
  sendPasswordReset,
  setStaffActive,
  type StaffMember,
} from "@/lib/staff";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * The team screen — admins only.
 *
 * Every button here is a request to a `security definer` function that asks
 * Postgres whether the caller's own row says `role = 'admin'`. A staff account
 * that somehow reached this screen would get a refusal from the database, not a
 * silent success, which is why hiding the tab is a convenience rather than the
 * security boundary.
 *
 * On credentials. Supabase Auth keeps a one-way bcrypt hash and hands the
 * plaintext to nobody, so an existing password cannot be displayed here — not
 * to this panel, not to the owner, not to anyone with dashboard access either.
 * What the panel can do is show the two halves of the truth: the sign-in address
 * is visible on every row, and the password is either the one the owner just
 * assigned (printed once, in the handover card, to be copied into a message) or
 * one the member chooses themselves from a setup link.
 */
export function StaffManager() {
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [initialPassword, setInitialPassword] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addDone, setAddDone] = useState<string | null>(null);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  /**
   * The credentials the owner just created, shown once so they can be copied
   * into a message and then dismissed. `password` is null when the account was
   * made without one, because the member picks their own from a setup link.
   */
  const [handover, setHandover] = useState<{
    email: string;
    password: string | null;
  } | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  /** Bumping this re-runs the fetch below — the only way this panel reloads. */
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((count) => count + 1);

  // The result is applied from the promise callback rather than the effect body,
  // so mounting the panel does not set state on its way in. The Refresh button
  // drives the same path, so a press always re-queries the database — there is
  // no cached list to fall back on and nothing to reload the page for.
  useEffect(() => {
    let active = true;
    setRefreshing(true);
    listStaff()
      .then((rows) => {
        if (!active) return;
        setMembers(rows);
        setListError(null);
        setSyncedAt(new Date().toLocaleTimeString());
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMembers([]);
        setListError(
          isMissingFunction(error)
            ? "The team functions are not on this project yet — run supabase/schema.sql once, then press Refresh."
            : error instanceof Error
              ? error.message
              : "Could not load the team.",
        );
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const submitAdd = async () => {
    setAddBusy(true);
    setAddError(null);
    setAddDone(null);
    // Captured before the fields are cleared: this is the only moment the
    // plaintext exists anywhere the owner can still read it.
    const address = email.trim().toLowerCase();
    const chosen = initialPassword.trim();
    try {
      const result = await addStaffAccount(email, role, initialPassword);
      setConfirmingAdd(false);
      setEmail("");
      setInitialPassword("");
      setHandover(
        result.createdSignIn ? { email: address, password: chosen || null } : null,
      );
      setAddDone(
        !result.createdSignIn
          ? "That account already existed — the role has been granted to it."
          : result.usedResetLink
            ? "Account created and a password-setup link emailed. Their role is live already."
            : "Account created. They sign in with the password you set, and can change it from Your account.",
      );
      toast.success(`${role === "admin" ? "Admin" : "Staff"} added`);
      refresh();
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Could not add that account.",
      );
    } finally {
      setAddBusy(false);
    }
  };

  const run = async (
    id: string,
    label: string,
    action: () => Promise<unknown>,
  ) => {
    setBusyId(id);
    try {
      await action();
      toast.success(label);
      refresh();
    } catch (error) {
      toast.error("That change was refused", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
        duration: 8000,
      });
    } finally {
      setBusyId(null);
      setPendingRemove(null);
      setConfirmingDelete(null);
    }
  };

  const addReady = email.trim().includes("@") && !addBusy;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Users className="size-5 text-gold" aria-hidden />
          Team
        </h2>
        <p className="text-sm text-muted-foreground">
          Who may open these portals, and as what. Staff work the floor desk;
          admins also control the menu, photos, promotions and this list. Only an
          admin can change any of it.
        </p>
      </div>

      {/* ————— Add someone ————— */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
            <MailPlus className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-semibold">
              Add a team member
            </p>
            <p className="text-xs text-muted-foreground">
              This creates their sign-in account via Supabase Auth and records
              the role — no service-role key, and nothing to configure in the
              dashboard.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-email" className="text-xs">
              Their email
            </Label>
            <Input
              id="team-email"
              type="email"
              value={email}
              inputMode="email"
              spellCheck={false}
              placeholder="name@janoon.pk"
              className="h-11 rounded-xl bg-background/60"
              onChange={(event) => {
                setAddError(null);
                setAddDone(null);
                setEmail(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Role</Label>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-background/40 p-1">
              {(["staff", "admin"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={role === option}
                  onClick={() => setRole(option)}
                  className={
                    role === option
                      ? "rounded-lg bg-gold/15 px-3 py-2 text-xs font-medium text-gold"
                      : "rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {option === "staff" ? "Staff" : "Admin"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="team-password" className="text-xs">
              Initial password — optional
            </Label>
            <Input
              id="team-password"
              type="password"
              value={initialPassword}
              autoComplete="new-password"
              placeholder="Leave empty to email a setup link"
              className="h-11 rounded-xl bg-background/60"
              onChange={(event) => {
                setAddError(null);
                setAddDone(null);
                setInitialPassword(event.target.value);
              }}
            />
          </div>
        </div>

        {addError ? (
          <p
            className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {addError}
          </p>
        ) : null}

        {addDone ? (
          <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold">
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {addDone}
          </p>
        ) : null}

        {/* The credentials, printed once. This is the only place the owner's
            chosen password is ever legible — not stored by the app, not written
            to the database, and gone the moment this card is dismissed. */}
        {handover ? (
          <div className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-gold/[0.08] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs leading-relaxed text-gold">
                <span className="font-semibold">Credentials to hand over.</span>{" "}
                Copy these into a message now — this card is not saved anywhere,
                and the password cannot be shown again afterwards.
              </p>
              <button
                type="button"
                aria-label="Hide the credentials"
                onClick={() => setHandover(null)}
                className="shrink-0 cursor-pointer rounded-lg p-1 text-gold/70 transition-colors hover:text-gold"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <CredentialRow label="Sign-in email" value={handover.email} />
            {handover.password ? (
              <CredentialRow label="Password" value={handover.password} />
            ) : (
              <p className="text-xs text-gold/80">
                No password was set, so a setup link was emailed instead — they
                choose their own.
              </p>
            )}
          </div>
        ) : null}

        {confirmingAdd ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-3"
          >
            <p className="text-xs leading-relaxed text-foreground/90">
              Add <span className="text-foreground">{email.trim()}</span> as{" "}
              {role === "admin" ? "an admin" : "staff"}?
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmingAdd(false)}
              >
                <X className="size-3.5" aria-hidden />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-gold to-ember font-semibold text-primary-foreground"
                disabled={addBusy}
                onClick={() => void submitAdd()}
              >
                {addBusy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5" aria-hidden />
                )}
                Confirm
              </Button>
            </div>
          </motion.div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-fit gap-2"
            disabled={!addReady}
            onClick={() => setConfirmingAdd(true)}
          >
            Add to team
          </Button>
        )}
      </div>

      {/* ————— The list ————— */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <ShieldCheck className="size-4 text-gold" aria-hidden />
            Current team
            {members ? (
              <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {members.length}
              </span>
            ) : null}
          </h3>
          <div className="flex items-center gap-3">
            {syncedAt ? (
              <span className="text-[0.7rem] text-muted-foreground tabular-nums">
                Synced {syncedAt}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              disabled={refreshing}
              onClick={refresh}
            >
              <RefreshCw
                className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refreshing ? "Syncing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {listError ? (
          <p
            className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-200"
            role="alert"
          >
            {listError}
          </p>
        ) : null}

        {members === null ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading the team…
          </p>
        ) : members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            No team accounts yet. Add the first one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={
                      member.role === "admin"
                        ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold"
                        : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-muted-foreground"
                    }
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{member.email ?? "—"}</span>
                      {member.email ? (
                        <CopyButton
                          value={member.email}
                          label={`Copy the sign-in email for ${member.email}`}
                        />
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                      {member.displayName ? <span>{member.displayName}</span> : null}
                    </p>
                    {/* The other half of the sign-in details, said plainly: the
                        address is the row above; the password is not something
                        this panel can show, because Supabase stores only a
                        hash. Setup link is the way back in. */}
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      Password: not retrievable — use{" "}
                      <span className="text-gold/90">Send setup link</span> to let
                      them choose a new one.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!member.roles.includes("admin") ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === member.userId}
                      onClick={() =>
                        void run(
                          member.userId,
                          "Admin role granted",
                          () => grantRole(member.userId, "admin"),
                        )
                      }
                    >
                      Grant admin
                    </Button>
                  ) : null}
                  {!member.roles.includes("staff") ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === member.userId}
                      onClick={() =>
                        void run(
                          member.userId,
                          "Staff role granted",
                          () => grantRole(member.userId, "staff"),
                        )
                      }
                    >
                      Grant staff
                    </Button>
                  ) : null}
                  {member.roles.length > 1 && member.roles.includes("staff") ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === member.userId}
                      onClick={() =>
                        void run(
                          member.userId,
                          "Staff role removed",
                          () => removeRole(member.userId, "staff"),
                        )
                      }
                    >
                      Remove staff
                    </Button>
                  ) : null}
                  {member.roles.length > 1 && member.roles.includes("admin") ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === member.userId}
                      onClick={() =>
                        void run(
                          member.userId,
                          "Admin role removed",
                          () => removeRole(member.userId, "admin"),
                        )
                      }
                    >
                      Remove admin
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busyId === member.userId}
                    onClick={() =>
                      void run(
                        member.userId,
                        member.active ? "Access suspended" : "Access restored",
                        () => setStaffActive(member.userId, !member.active),
                      )
                    }
                  >
                    {member.active ? (
                      <UserX className="size-3.5" aria-hidden />
                    ) : (
                      <UserCheck className="size-3.5" aria-hidden />
                    )}
                    {member.active ? "Suspend" : "Restore"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busyId === member.userId || !member.email}
                    onClick={() =>
                      void run(member.userId, "Setup link sent", () =>
                        sendPasswordReset(member.email as string),
                      )
                    }
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Send setup link
                  </Button>

                  {/* Removing keeps the sign-in account; deleting erases it,
                      which is the only way the address becomes reusable. The
                      two are kept apart so the permanent one is never the
                      button a stray click lands on. */}
                  {confirmingDelete === member.userId ? (
                    <>
                      <span className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-300">
                        This erases the sign-in account from the database, not
                        just the team entry. The address is released and can be
                        registered again from scratch. It cannot be undone.
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 bg-rose-500/90 font-semibold text-white hover:bg-rose-500"
                        disabled={busyId === member.userId}
                        onClick={() =>
                          void run(member.userId, "Account deleted", () =>
                            deleteStaffAccount(member.userId),
                          )
                        }
                      >
                        {busyId === member.userId ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-3.5" aria-hidden />
                        )}
                        Delete permanently
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-rose-300"
                      disabled={busyId === member.userId}
                      onClick={() => setConfirmingDelete(member.userId)}
                    >
                      <UserX className="size-3.5" aria-hidden />
                      Delete account
                    </Button>
                  )}

                  {pendingRemove === member.userId ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRemove(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 bg-rose-500/90 font-semibold text-white hover:bg-rose-500"
                        disabled={busyId === member.userId}
                        onClick={() =>
                          void run(member.userId, "Removed from the team", () =>
                            removeStaff(member.userId),
                          )
                        }
                      >
                        {busyId === member.userId ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-3.5" aria-hidden />
                        )}
                        Confirm remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-rose-300"
                      disabled={busyId === member.userId}
                      onClick={() => setPendingRemove(member.userId)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </Button>
                  )}

                  {busyId === member.userId &&
                  pendingRemove !== member.userId ? (
                    <Loader2
                      className="size-4 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">Remove</span> takes away portal
          access and leaves the sign-in account standing, so the person can be
          added back. <span className="text-foreground">Delete account</span>{" "}
          erases the sign-in account too and frees the address for a fresh
          registration. The last admin cannot be demoted, suspended, removed or
          deleted — promote someone else first, and nobody can delete the
          account they are signed in with.
        </p>
      </div>
    </section>
  );
}

/** A label/value line with a copy button — used for the handover card. */
function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/25 bg-background/50 px-3 py-2">
      <span className="text-[0.65rem] tracking-[0.18em] text-gold/70 uppercase">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm text-foreground select-all">
          {value}
        </span>
        <CopyButton value={value} label={`Copy the ${label.toLowerCase()}`} />
      </span>
    </div>
  );
}

/**
 * Copy to clipboard, and say so honestly: a browser that refuses the
 * permission is reported as a failure rather than as a silent success.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
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
