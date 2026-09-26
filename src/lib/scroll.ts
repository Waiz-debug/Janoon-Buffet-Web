/**
 * Smoothly scroll to an in-page target by id (used by the nav + CTAs).
 *
 * A target that is not on the page yet is not a failure: a guest who taps
 * "See all dishes" on a counter card is jumping to a chapter of the à la carte
 * board, which is rendered from the same live feed and may still be arriving.
 * So a missing target is retried for a moment before the tap is given up on,
 * and the last attempt is always a real scroll — never a silent no-op.
 */
export function scrollToSection(id: string) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let attempts = 0;

  const jump = () => {
    const target = document.getElementById(id);
    if (!target) {
      attempts += 1;
      if (attempts < 12) window.setTimeout(jump, 80);
      return;
    }
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  jump();
}
