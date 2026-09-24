import { cn } from "@/lib/utils";

/**
 * The JUNOON brand mark.
 *
 * One asset, reused everywhere a logo belongs — `public/logo.svg`, the gold
 * shield crest the apple-touch icon and the manifest icons are cut from. Sites
 * that used to stand a generic icon in for a logo (the header, both portals,
 * the 404, the auth cards) render this instead, so there is exactly one in-app
 * brand mark to change.
 *
 * The crest carries no wordmark: "JUNOON" and the lines under it are real text
 * beside this mark, where they stay crisp and readable at any size. The browser
 * tab is the one place the crest is deliberately not used — its dotted ring and
 * leaf turn to mush at 16px, so the tab is drawn from `public/favicon.svg`. See
 * `tools/generate-favicons.mjs`.
 *
 * `className` sets the size — `size-9`, `size-10`, `size-14` — because the
 * asset already carries its own tile and radius and nothing is drawn on top.
 * Leave `alt` empty where the name sits next to the mark (the header lockups),
 * and set it where the mark stands alone.
 */
export function JunoonMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/logo.svg"
      alt={alt}
      width={512}
      height={512}
      className={cn("shrink-0 rounded-xl", className)}
    />
  );
}

/** Backwards-compatible alias so existing imports keep working. */
export const JanoonMark = JunoonMark;
