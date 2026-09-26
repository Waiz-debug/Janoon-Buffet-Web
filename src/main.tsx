import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireRole } from "@/components/RequireRole";
import { JanoonMark } from "@/components/tribe/JanoonMark";
import { CartDrawer } from "@/components/tribe/CartDrawer";
import { CartProvider } from "@/hooks/use-cart";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, {
  StrictMode,
  useEffect,
  lazy,
  Suspense,
  type ComponentType,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { scrollToSection } from "@/lib/scroll";
import "./index.css";
import { testSupabaseConnection } from "./lib/test-supabase";

/**
 * A route chunk, loaded with one quiet retry.
 *
 * The dev/preview server restarts and rebuilds while a tab is open, so a
 * module URL that answered a moment ago can be gone by the time the router
 * asks for it — the browser reports "Failed to fetch dynamically imported
 * module" and the whole screen falls to the error boundary. One retry a moment
 * later covers a server that is still coming back; if the chunk is really
 * gone the page reloads itself once, so the router asks for the current URL
 * instead of the stale one.
 *
 * The session flag is what keeps that from becoming a reload loop: the first
 * failure of a route reloads, the second is thrown to the boundary, which
 * offers the guest a Reload button rather than retrying forever.
 */
function lazyWithRetry<T extends ComponentType>(
  name: string,
  load: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const flag = `junoon:route-reload:${name}`;
    try {
      const page = await load();
      sessionStorage.removeItem(flag);
      return page;
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      try {
        const page = await load();
        sessionStorage.removeItem(flag);
        return page;
      } catch (error) {
        if (!sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, "1");
          window.location.reload();
          // The reload is already on its way. Resolving here would let React
          // draw a route whose code never arrived, so this promise is left
          // pending on purpose — the tab is replaced a moment later.
          return new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}

// Lazy load route components for better code splitting
const Gateway = lazyWithRetry("gateway", () => import("./pages/AuthLanding.tsx"));
const RestaurantSite = lazyWithRetry("restaurant", () => import("./pages/Landing.tsx"));
const AuthPage = lazyWithRetry("auth", () => import("./pages/Auth.tsx"));
const Dashboard = lazyWithRetry("dashboard", () => import("./pages/Dashboard.tsx"));
const MenuDetail = lazyWithRetry("menu-detail", () => import("./pages/MenuDetail.tsx"));
const ManageBooking = lazyWithRetry("manage-booking", () => import("./pages/ManageBooking.tsx"));
const StaffPortal = lazyWithRetry("staff", () => import("./pages/StaffPortal.tsx"));
const AdminPortal = lazyWithRetry("admin", () => import("./pages/AdminPortal.tsx"));
const OrderPage = lazyWithRetry("order", () => import("./pages/Order.tsx"));
const Deliveries = lazyWithRetry("deliveries", () => import("./pages/Deliveries.tsx"));
const NotFound = lazyWithRetry("not-found", () => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions — the restaurant's own mark
// rather than a bare "Loading…", so a slow chunk still looks like JUNOON.
function RouteLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <JanoonMark className="size-12 animate-pulse" />
      <p className="text-[0.65rem] font-medium tracking-[0.24em] text-gold/70 uppercase">
        Junoon
      </p>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      // A route chunk that could not be fetched is a stale file, not a crash:
      // the server was rebuilt while this tab was open. Say that, and offer the
      // one action that fixes it, instead of showing a raw fetch error and a
      // stack trace the guest cannot use.
      const staleChunk =
        /dynamically imported module|Importing a module script failed|module script failed/i.test(
          this.state.message,
        );
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="flex max-w-lg flex-col items-center text-center">
            <JanoonMark className="size-12" />
            <p className="mt-4 text-sm font-semibold">
              {staleChunk
                ? "Junoon — the page could not finish loading"
                : "Junoon — this screen hit an error"}
            </p>
            <p className="mt-2 text-xs break-words text-muted-foreground">
              {staleChunk
                ? "The site's files were updated while this page was open. Reload to open the current version."
                : this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-[0.7rem] font-medium tracking-[0.16em] text-accent-foreground uppercase transition-opacity hover:opacity-90"
            >
              Reload page
            </button>
            {!staleChunk && this.state.stack ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded border border-border/60 p-2 text-left text-[10px] leading-4 text-muted-foreground/80">
                {this.state.stack}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



/** Honour `/#section` links so cross-page calls to action land on the right block. */
function ScrollToHash() {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    // One beat for the route to paint, then the same smooth, motion-aware
    // scroll the in-page nav uses — so a link to `#top` glides home from
    // another page exactly as it does from within the page. `scrollToSection`
    // also waits for a target that has not rendered yet, which a fixed delay
    // could not do.
    const timer = window.setTimeout(() => scrollToSection(id), 120);
    return () => window.clearTimeout(timer);
  }, [hash, key]);
  return null;
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


// Run connection test once on startup (fire-and-forget, never blocks the UI)
testSupabaseConnection();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <CartProvider>
          <BrowserRouter>
          <RouteSyncer />
          <ScrollToHash />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Gateway />} />
              <Route path="/restaurant" element={<RestaurantSite />} />
              <Route path="/menu/:slug" element={<MenuDetail />} />
              <Route path="/order" element={<OrderPage />} />
              <Route path="/manage" element={<ManageBooking />} />
              <Route
                path="/staff"
                element={
                  <RequireRole role="staff">
                    <StaffPortal />
                  </RequireRole>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireRole role="admin">
                    <AdminPortal />
                  </RequireRole>
                }
              />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/restaurant" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireRole role="staff">
                    <Dashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/deliveries"
                element={
                  <RequireRole role="staff">
                    <Deliveries />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CartDrawer />
          </BrowserRouter>
        </CartProvider>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
