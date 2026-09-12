import { scrollToSection } from "@/lib/scroll";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Jump to a public-site section from anywhere in the app: scrolls when the
 * visitor already sits on the restaurant page, otherwise routes to
 * `/restaurant#section` so the ScrollToHash handler lands on the right block.
 */
export function useGoToSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (id: string) => {
      if (pathname !== "/restaurant") {
        navigate(`/restaurant#${id}`);
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
