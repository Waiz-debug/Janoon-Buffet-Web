import { cn } from "@/lib/utils";

/**
 * The Janoon brand mark.
 *
 * One asset, reused everywhere a logo belongs — `public/logo.svg`, the gold "J"
 * on the charcoal tile that the favicon, the apple-touch icon and the manifest
 * icons are all cut from. Sites that used to stand a generic icon in for a logo
 * (the header, both portals, the 404, the auth cards) render this instead, so
 * there is exactly one brand mark to change.
 *
 * `className` sets the size — `size-9`, `size-10`, `size-14` — because the
 * asset already carries its own tile and radius and nothing is drawn on top.
 * Leave `alt` empty where the name sits next to the mark (the header lockups),
 * and set it where the mark stands alone.
 */
export function JanoonMark({
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
