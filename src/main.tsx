import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireRole } from "@/components/RequireRole";
import { JanoonMark } from "@/components/tribe/JanoonMark";
import { CartDrawer } from "@/components/tribe/CartDrawer";
import { CartProvider } from "@/hooks/use-cart";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { testSupabaseConnection } from "./lib/test-supabase";

// Lazy load route components for better code splitting
const Gateway = lazy(() => import("./pages/AuthLanding.tsx"));
const RestaurantSite = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const MenuDetail = lazy(() => import("./pages/MenuDetail.tsx"));
const ManageBooking = lazy(() => import("./pages/ManageBooking.tsx"));
const StaffPortal = lazy(() => import("./pages/StaffPortal.tsx"));
const AdminPortal = lazy(() => import("./pages/AdminPortal.tsx"));
const OrderPage = lazy(() => import("./pages/Order.tsx"));
const Deliveries = lazy(() => import("./pages/Deliveries.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="flex max-w-lg flex-col items-center text-center">
            <JanoonMark className="size-12" />
            <p className="mt-4 text-sm font-semibold">Junoon — this screen hit an error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
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
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 120);
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
