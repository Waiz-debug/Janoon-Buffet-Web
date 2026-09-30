import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffRole } from "@/hooks/use-staff-auth";
import {
  addStaffAccount,
  confirmStaffEmail,
  deleteStaffAccount,
  grantRole,
  isMissingFunction,
  listStaff,
  removeRole,
  removeStaff,
  replaceStaffAccount,
  sendPasswordReset,
  setStaffActive,
  StaffListError,
  syncStaffRoles,
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
  Wrench,
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
  /**
   * The row whose password is being replaced, and the password typed for it.
   *
   * The one route back in that needs no working mail provider at all: the old
   * sign-in account is deleted and a new one created for the same address with
   * a password chosen here. It lives on the member's own row rather than in a
   * separate screen, because it is a team-management action — the same class of
   * thing as suspending somebody — not a place to browse credentials.
   */
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [rowNote, setRowNote] = useState<{ id: string; text: string } | null>(
    null,
  );
  /** The junction-table repair, and what it found. */
  const [repairing, setRepairing] = useState(false);
  const [repairNote, setRepairNote] = useState<string | null>(null);

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
        // The reason is kept rather than flattened: a refused read and a
        // missing function need completely different advice, and neither is
        // the same thing as an empty team.
        const reason =
          error instanceof StaffListError ? error.reason : "unknown";
        console.error(`[Junoon] team list failed (${reason}):`, error);
        setListError(
          reason === "not-admin"
            ? "This account is not an admin, so the team list is not shown here. Use the admin door."
            : reason === "missing-function"
              ? "The team functions are not on this project yet — paste supabase/fix-admin-recovery.sql into the SQL editor, then press Refresh."
              : isMissingFunction(error)
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

      // The new member is put on screen from the record the database returned —
      // the row read back under the Auth UUID the grant itself handed over, so
      // what appears here is what is really in `staff_members`, not a guess
      // built from the form. `addStaffAccount` throws rather than returning a
      // missing record, so reaching this line means the row exists.
      if (result.member) {
        setMembers((current) =>
          current
            ? [
                ...current.filter(
                  (existing) => existing.userId !== result.member?.userId,
                ),
                result.member as StaffMember,
              ].sort(
                (a, b) =>
                  (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
                  (a.email ?? "").localeCompare(b.email ?? ""),
              )
            : [result.member as StaffMember],
        );
        setListError(null);
      }

      // Say exactly what happened to the password, because the two failure
      // cases below are the ones that otherwise read as "wrong password" to
      // whoever is trying to sign in.
      setAddDone(
        !result.passwordApplied
          ? `That address already had an account, so the password you typed was not applied — their existing password still works. ${
              result.usedResetLink
                ? "A setup link has been emailed so they can set a password you both know."
                : "Use Send setup link on their row to email one."
            }`
          : result.needsConfirmation
            ? "Account created and added to the team, but the address still has to be confirmed before the first sign-in — a setup link has been emailed, or press Confirm address on their row."
            : result.confirmedByPortal
              ? "Account created and the address confirmed — they can sign in straight away with the password below."
              : result.usedResetLink
                ? "Account created and a password-setup link emailed. Their role is live already."
                : "Account created. They sign in with the password you set.",
      );
      toast.success(`${role === "admin" ? "Admin" : "Staff"} added to the team`);
      // …and the whole list is re-read, so the row on screen is confirmed
      // against the database rather than left as this panel's own copy of it.
      refresh();
    } catch (error) {
      // The database refused, or wrote nothing. The real reason is shown and no
      // success is claimed: a member who is not in the list is not on the team.
      setAddError(
        error instanceof Error ? error.message : "Could not add that account.",
      );
      setHandover(null);
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

  /**
   * Put the three stores back in step, then re-read the list.
   *
   * A staff account lives in `auth.users` (the sign-in), `staff_members` (the
   * row that lets a portal open) and `staff_member_roles` (which roles it
   * holds). A member whose junction row is missing reads as holding *no role at
   * all* — on screen and at every policy that asks. This writes the roles that
   * are already on their row, and only those; it never deletes a record, never
   * invents an account and never touches a role somebody chose. Accounts whose
   * sign-in is gone are counted and reported, because that is the owner's
   * decision to make rather than a function's.
   */
  const repair = async () => {
    setRepairing(true);
    setRepairNote(null);
    try {
      const outcome = await syncStaffRoles();
      setRepairNote(
        outcome.rolesAdded > 0
          ? `Repaired: ${outcome.rolesAdded} role${
              outcome.rolesAdded === 1 ? " was" : "s were"
            } written to match the team rows.` +
            (outcome.accountsMissing > 0
              ? ` ${outcome.accountsMissing} record${
                  outcome.accountsMissing === 1 ? " has" : "s have"
                } no sign-in account left — those people can never sign in; remove or replace the record.`
              : "")
          : "Everything was already in step — no role records were missing." +
            (outcome.accountsMissing > 0
              ? ` ${outcome.accountsMissing} record${
                  outcome.accountsMissing === 1 ? " has" : "s have"
                } no sign-in account left.`
              : ""),
      );
      refresh();
    } catch (error) {
      setRepairNote(
        isMissingFunction(error)
          ? "This project has not been patched yet — run supabase/fix-admin-recovery.sql in the Supabase SQL editor, then try again."
          : error instanceof Error
            ? error.message
            : "Could not run the repair. Try again in a moment.",
      );
    } finally {
      setRepairing(false);
    }
  };

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
              and the password cannot be shown again afterwards. If it is ever
              lost, set a new one from the member&apos;s row below.
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
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={repairing}
              title="Rewrite any missing role records so every member's roles are what their team row says"
              onClick={() => void repair()}
            >
              {repairing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Wrench className="size-3.5" aria-hidden />
              )}
              {repairing ? "Repairing…" : "Repair roles"}
            </Button>
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

        {repairNote ? (
          <p
            className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold"
            role="status"
          >
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {repairNote}
          </p>
        ) : null}

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
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4"
              >
                {/*
                  Name · Email · Role · Active, each as its own labelled column
                  rather than a single line of pills. They are four different
                  facts about a person and they get read in that order when
                  somebody is standing at the till; the actions then sit below,
                  on their own row, so nothing is squeezed out on a narrow
                  screen.
                */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={
                        member.role === "admin"
                          ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold"
                          : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-muted-foreground"
                      }
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                    </span>
                    <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-[0.6rem] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                          Name
                        </dt>
                        <dd className="truncate text-sm font-medium">
                          {member.displayName ||
                            member.email?.split("@")[0] ||
                            "Unnamed"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[0.6rem] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                          Email
                        </dt>
                        <dd className="flex items-center gap-2 text-sm">
                          <span className="truncate">
                            {member.email ?? "— no address on record"}
                          </span>
                          {member.email ? (
                            <CopyButton
                              value={member.email}
                              label={`Copy the sign-in email for ${member.email}`}
                            />
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.6rem] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                          Role
                        </dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                          {(member.roles.length > 0
                            ? member.roles
                            : [member.role]
                          ).map((r) => (
                            <span
                              key={r}
                              className={
                                r === "admin"
                                  ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.7rem] text-gold"
                                  : "rounded-full border border-border/70 px-2 py-0.5 text-[0.7rem]"
                              }
                            >
                              {r}
                            </span>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.6rem] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                          Status
                        </dt>
                        <dd className="mt-1">
                          <span
                            className={
                              member.active
                                ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.7rem] text-gold"
                                : "rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] text-rose-300"
                            }
                          >
                            {member.active ? "Active" : "Inactive"}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {rowNote?.id === member.userId ? (
                  <p
                    className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-gold"
                    role="status"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {rowNote.text}
                  </p>
                ) : null}

                {/* The no-email route back in, on the member's own row: the old
                    sign-in account is deleted and a new one created for the
                    same address with the password typed here. It needs no
                    working mail provider, no confirmation link and no patience,
                    and the role is carried across. */}
                {replacingId === member.userId ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-3.5"
                  >
                    <p className="text-xs leading-relaxed text-foreground/85">
                      This <span className="text-foreground">replaces the
                      sign-in account</span> for{" "}
                      <span className="text-foreground">{member.email}</span>:
                      the old one is erased and a new one created with the
                      password you type here. No email is involved, so it works
                      even when mail cannot be delivered. Their role is carried
                      across, and the account gets a new user id — so its start
                      date begins again.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <label
                          htmlFor={`new-password-${member.userId}`}
                          className="text-[0.65rem] tracking-[0.18em] text-gold/80 uppercase"
                        >
                          The password to set
                        </label>
                        <Input
                          id={`new-password-${member.userId}`}
                          type="text"
                          value={newPassword}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="At least 8 characters"
                          className="h-10 rounded-xl bg-background/60 font-mono"
                          onChange={(event) => {
                            setNewPassword(event.target.value);
                            setRowNote(null);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 gap-1.5"
                        disabled={newPassword.length < 8 || busyId === member.userId}
                        onClick={() =>
                          void run(
                            member.userId,
                            "Password set",
                            async () => {
                              const outcome = await replaceStaffAccount(
                                member.userId,
                                member.email as string,
                                member.role,
                                newPassword,
                              );
                              setNewPassword("");
                              setReplacingId(null);
                              setRowNote({
                                id: member.userId,
                                text: outcome.needsConfirmation
                                  ? `A new account exists for ${member.email}. Confirm the address on this row, then the password you just typed is the one that works.`
                                  : `A new account exists for ${member.email}. They can sign in now with the password you just typed, and their role is unchanged.`,
                              });
                            },
                          )
                        }
                      >
                        {busyId === member.userId ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <KeyRound className="size-3.5" aria-hidden />
                        )}
                        Set this password
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10"
                        onClick={() => {
                          setReplacingId(null);
                          setNewPassword("");
                        }}
                      >
                        <X className="size-3.5" aria-hidden />
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
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

                  {/* For an account created before the panel could confirm an
                      address itself, or on a project whose mail never arrives:
                      one press stamps the confirmation and the member signs in
                      with the password they were given. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    title="Mark this address as confirmed so the member can sign in"
                    disabled={busyId === member.userId || !member.email}
                    onClick={() =>
                      void run(
                        member.userId,
                        "Address confirmed",
                        async () => {
                          const changed = await confirmStaffEmail(
                            member.email as string,
                          );
                          setRowNote({
                            id: member.userId,
                            text: changed
                              ? `${member.email} is confirmed — the member can sign in now, with the password they were given.`
                              : `${member.email} was already confirmed; nothing to change.`,
                          });
                        },
                      )
                    }
                  >
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Confirm address
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    title="Replace the sign-in account with one that has a password you choose"
                    disabled={busyId === member.userId || !member.email}
                    onClick={() => {
                      setRowNote(null);
                      setNewPassword("");
                      setReplacingId(
                        replacingId === member.userId ? null : member.userId,
                      );
                    }}
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Set password
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

        <p className="text-xs leading-relaxed text-muted-foreground">
          An existing password is never shown here and cannot be: Supabase Auth
          stores a one-way hash and hands the plaintext back to nobody. The
          password you set while adding somebody is printed once, in the handover
          card above. After that, the two routes back in are{" "}
          <span className="text-gold">Send setup link</span> (they choose their
          own) and <span className="text-gold">Set password</span> (you choose
          one now, with no email involved).
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
