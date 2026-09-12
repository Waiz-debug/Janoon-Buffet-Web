import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const VALID_PIN = "01234";
const STORAGE_KEY = "tribe-of-taste:pin-session";

export type PINRole = "staff" | "admin";

function readSession(): { role: PINRole; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.role || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > 24 * 60 * 60 * 1000) return null;
    return parsed as { role: PINRole; at: number };
  } catch {
    return null;
  }
}

function writeSession(role: PINRole) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ role, at: Date.now() }),
    );
  } catch {
    /* ignore private mode / storage errors */
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function useQueryRole() {
  const [role, setRole] = useState<PINRole | null>(() =>
    typeof window === "undefined" ? null : (readSession()?.role ?? null),
  );
  useEffect(() => {
    setRole(readSession()?.role ?? null);
  }, []);
  return role;
}

export function usePINSession() {
  const [role, setRole] = useState<PINRole | null>(() =>
    typeof window === "undefined" ? null : (readSession()?.role ?? null),
  );

  const verify = async (pin: string): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 60));
    if (pin !== VALID_PIN) return false;
    const next: PINRole = "admin";
    writeSession(next);
    setRole(next);
    return true;
  };

  const logout = () => {
    clearSession();
    setRole(null);
  };

  return { role, verify, logout };
}

export default function PINAuthPage() {
  const queryRole = useQueryRole();
  const [mode, setMode] = useState<"ask-role" | "verify" | "verified">(
    queryRole ? "verified" : "ask-role",
  );
  const [currentRole, setCurrentRole] = useState<PINRole | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "verify") inputRef.current?.focus();
  }, [mode]);

  const startVerification = (role: PINRole) => {
    setCurrentRole(role);
    setMode("verify");
    setPin("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter the PIN.");
      return;
    }

    const ok = await (window as any)._tribeVerifyPin?.(pin.trim());
    if (!ok) {
      setError("That PIN is not correct. Try again.");
      setAttempts((n) => n + 1);
      setPin("");
      return;
    }

    setMode("verified");
  };

  const handleLogout = () => {
    clearSession();
    setMode("ask-role");
    setCurrentRole(null);
  };

  const renderPinInput = () => (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 text-center sm:max-w-xs"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs uppercase text-muted-foreground/80">
          {currentRole === "staff" ? "Staff" : "Admin"}
        </span>
        <p className="text-sm text-muted-foreground">
          Enter the PIN to continue
        </p>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            ref={inputRef}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
              setPin(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(e);
            }}
            placeholder="01234"
            maxLength={6}
            className="pl-9 font-mono text-center tracking-widest text-sm"
            aria-label="PIN entry"
          />
        </div>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setMode("ask-role")}
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={pin.length !== 5}
        >
          Verify PIN
        </Button>
      </div>
    </form>
  );

  if (mode === "ask-role") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(193,138,53,0.12),transparent_55%)]" />
        </div>

        <header className="border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
                <Lock className="size-4" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold">Tribe of Taste</p>
                <p className="text-[0.65rem] tracking-[0.2em] text-amber-400/80 uppercase">
                  Secure access
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
          <div className="w-full max-w-lg text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/70 bg-card/60 p-8 shadow-lg shadow-black/20"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-400">
                <Lock className="size-4" />
              </span>
              <h1 className="font-display text-2xl font-semibold text-balance">
                Select the portal you need
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Staff and admin access are both protected by the same PIN. Once
                entered, the session stays valid for 24 hours on this device.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => startVerification("staff")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-4 transition-colors hover:border-amber-500/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3Z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-foreground">Staff Portal</p>
                    <p className="text-xs text-muted-foreground">Reservations desk &amp; live orders</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => startVerification("admin")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-4 transition-colors hover:border-amber-500/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-foreground">Admin Portal</p>
                    <p className="text-xs text-muted-foreground">Menu, pricing, assets &amp; reservations</p>
                  </div>
                </button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground/70">
                Both portals use PIN 01234. No account is required.
              </p>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "verified") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </span>
              <div>
                <p className="font-display text-base font-semibold">
                  {currentRole === "staff" ? "Staff Portal" : "Admin Portal"}
                </p>
                <p className="text-[0.65rem] tracking-[0.2em] text-muted-foreground/80 uppercase">
                  Verified session
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-emerald-300"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="font-medium">
                {currentRole === "staff"
                  ? "Staff access granted"
                  : "Admin access granted"}
              </span>
            </motion.div>

            <p className="mt-6 text-sm text-muted-foreground">
              Redirecting to your dashboard…
            </p>

            <div className="mt-8 flex justify-center">
              <Button
                asChild
                size="lg"
                className="gap-2"
              >
                <a
                  href={
                    currentRole === "staff"
                      ? "/dashboard"
                      : "/admin"
                  }
                >
                  Open dashboard
                </a>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <Lock className="size-4" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Tribe of Taste</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-amber-400/80 uppercase">
                PIN verification
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/70 bg-card/60 p-6 shadow-lg shadow-black/20"
          >
            {renderPinInput()}
          </motion.div>
        </div>
      </main>

      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(193,138,53,0.35); }
          70% { box-shadow: 0 0 0 10px rgba(193,138,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(193,138,53,0); }
        }
      `}</style>
    </div>
  );
}

(window as any)._tribeVerifyPin = async (pin: string) => {
  return pin === VALID_PIN;
};
