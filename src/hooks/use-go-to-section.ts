import { scrollToSection } from "@/lib/scroll";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Jump to a landing-page section from anywhere in the app: scrolls when the
 * visitor already sits on the landing page, otherwise routes to `/#section`.
 */
export function useGoToSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (id: string) => {
      if (pathname !== "/") {
        navigate(`/#${id}`);
        return;
      }
      if (id === "top") {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        return;
      }
      scrollToSection(id);
    },
    [navigate, pathname],
  );
}
