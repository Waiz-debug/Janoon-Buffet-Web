import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffRole } from "@/hooks/use-staff-auth";
import {
  addStaffAccount,
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
 * Nobody's password is shown or stored: the optional field below is the initial
 * password the owner hands over in person, and leaving it empty means the member
 * picks their own from a reset link instead.
 */
export function StaffManager() {
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [initialPassword, setInitialPassword] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addDone, setAddDone] = useState<string | null>(null);
  const [confirmingAdd, setConfirmingAdd] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  /** Bumping this re-runs the fetch below — the only way this panel reloads. */
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((count) => count + 1);

  // The result is applied from the promise callback rather than the effect body,
  // so mounting the panel does not set state on its way in.
  useEffect(() => {
    let active = true;
    listStaff()
      .then((rows) => {
        if (!active) return;
        setMembers(rows);
        setListError(null);
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
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const submitAdd = async () => {
    setAddBusy(true);
    setAddError(null);
    setAddDone(null);
    try {
      const result = await addStaffAccount(email, role, initialPassword);
      setConfirmingAdd(false);
      setEmail("");
      setInitialPassword("");
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
          admin can change any of it, and nobody&apos;s password is ever visible
          here.
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
          <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-emerald-200">
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {addDone}
          </p>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={refresh}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
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
                    <p className="truncate text-sm font-medium">
                      {member.email ?? "—"}
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
                            ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300"
                            : "rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300"
                        }
                      >
                        {member.active ? "active" : "suspended"}
                      </span>
                      {member.displayName ? <span>{member.displayName}</span> : null}
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
          Removing someone takes away their portal access and leaves their
          sign-in account alone. The last admin cannot be demoted, suspended or
          removed — promote someone else first.
        </p>
      </div>
    </section>
  );
}
