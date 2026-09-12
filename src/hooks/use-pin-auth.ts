import { useCallback, useEffect, useState } from "react";

const PIN_STORAGE_KEY = "tribe-of-taste:pin-session";
const VALID_PIN = "01234";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type PINRole = "staff" | "admin";

export type PINSession = {
  role: PINRole;
  authenticatedAt: number;
};

/** Staff and admin land on their own dashboards after the same PIN check. */
export function portalPathFor(role: PINRole): string {
  return role === "staff" ? "/staff" : "/admin";
}

export function isValidPin(pin: string): boolean {
  return pin.trim() === VALID_PIN;
}

function isExpired(session: PINSession): boolean {
  return Date.now() - session.authenticatedAt > SESSION_TTL_MS;
}

export function readPinSession(): PINSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PINSession | null;
    if (
      !parsed ||
      (parsed.role !== "staff" && parsed.role !== "admin") ||
      typeof parsed.authenticatedAt !== "number"
    ) {
      return null;
    }
    if (isExpired(parsed)) {
      window.localStorage.removeItem(PIN_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePinSession(role: PINRole): PINSession {
  const session: PINSession = { role, authenticatedAt: Date.now() };
  try {
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* Private browsing: the session simply lives for the tab. */
  }
  return session;
}

export function clearPinSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Reactive session state shared by the PIN screen and the portal guards. */
export function usePinSession() {
  const [session, setSession] = useState<PINSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSession(readPinSession());
    setIsLoaded(true);
  }, []);

  const verify = useCallback((pin: string, role: PINRole): boolean => {
    if (!isValidPin(pin)) return false;
    setSession(writePinSession(role));
    return true;
  }, []);

  const logout = useCallback(() => {
    clearPinSession();
    setSession(null);
  }, []);

  return { session, isLoaded, verify, logout };
}
