import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const PIN_STORAGE_KEY = "tribe-of-taste:pin-session";
const VALID_PIN = "01234";
const MAX_PIN_ATTEMPTS = 5;

export type PINRole = "staff" | "admin" | null;
export type PINSession = {
  role: PINRole;
  authenticatedAt: number;
};

interface PINAuthContextValue {
  role: PINRole;
  session: PINSession | null;
  isLoaded: boolean;
  verifyPin: (pin: string) => Promise<PINRole | null>;
  logout: () => void;
  clearAttempts: () => void;
  attemptsRemaining: number;
}

const PINAuthContext = createContext<PINAuthContextValue | null>(null);

const MAX_ATTEMPTS_KEY = "tribe-of-taste:pin-attempts";

function readAttempts(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(MAX_ATTEMPTS_KEY);
    if (!raw) return MAX_PIN_ATTEMPTS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, MAX_PIN_ATTEMPTS - n) : MAX_PIN_ATTEMPTS;
  } catch {
    return MAX_PIN_ATTEMPTS;
  }
}

function recordAttempt(): void {
  if (typeof window === "undefined") return;
  try {
    const current = readAttempts();
    const remaining = Math.max(0, current - 1);
    window.localStorage.setItem(
      MAX_ATTEMPTS_KEY,
      String(MAX_PIN_ATTEMPTS - remaining),
    );
  } catch {
    /* ignore */
  }
}

function resetAttempts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MAX_ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

function readSession(): PINSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PINSession;
    if (!parsed || !parsed.role || typeof parsed.authenticatedAt !== "number") {
      return null;
    }
  } catch {
    return null;
  }
  // keep the file ending clean
  if (Date.now() - parsed.authenticatedAt > 24 * 60 * 60 * 1000) {
    return null;
  }
  return parsed;
}

function writeSession(session: PINSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(session));
    resetAttempts();
  } catch {
    /* ignore */
  }
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function verifyPinSync(pin: string): PINRole | null {
  if (pin !== VALID_PIN) return null;
  return "admin";
}

export function usePINAuth() {
  const [session, setSession] = useState<PINSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setIsLoaded(true);
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<PINRole | null> => {
    await new Promise((r) => setTimeout(r, 80));
    const roleResult = verifyPinSync(pin);
    if (!roleResult) {
      recordAttempt();
      return null;
    }
    const newSession: PINSession = {
      role: roleResult,
      authenticatedAt: Date.now(),
    };
    writeSession(newSession);
    setSession(newSession);
    return roleResult;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const clearAttempts = useCallback(() => {
    resetAttempts();
  }, []);

  const attemptsRemaining = readAttempts();

  return {
    role: session?.role ?? null,
    session,
    isLoaded,
    verifyPin,
    logout,
    clearAttempts,
    attemptsRemaining,
  };
}

export function usePINAuthContext() {
  const ctx = useContext(PINAuthContext);
  if (!ctx) {
    throw new Error("usePINAuthContext must be used inside PINAuthProvider");
  }
  return ctx;
}

export function PINAuthProvider({ children }: { children: ReactNode }) {
  const value = usePINAuth();
  return (
    <PINAuthContext.Provider value={value}>{children}</PINAuthContext.Provider>
  );
}
// end of file marker
