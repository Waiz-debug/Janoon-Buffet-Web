import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { useState } from "react";

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Extra classes for the themed tile shown when the photo cannot load. */
  fallbackClassName?: string;
  /** Size of the flame on that tile — a 56px row thumbnail needs a smaller
   *  mark than a full-width dish photo does. */
  glyphClassName?: string;
  loading?: "lazy" | "eager";
};

/**
 * Photo with a dignified heritage fallback.
 *
 * A dish the kitchen has not photographed yet, a demo URL that has gone stale,
 * an upload the owner cleared — all three arrive here as "no picture", and none
 * of them should look like a broken image. They get the house tile instead:
 * deep maroon fading into the page, a brass hairline and the flame mark, so the
 * gap reads as part of the design. The 1200px demo photos are the only thing
 * that ever fills it in; see `photoThumb` for the small sizes.
 */
export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
  glyphClassName = "size-8",
  loading = "lazy",
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  // A failed load must not be permanent. When the admin publishes a new photo
  // the `src` changes, so drop the failure and try the fresh URL instead of
  // sitting on the fallback tile until a hard reload.
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (src !== loadedSrc) {
    setLoadedSrc(src);
    setFailed(false);
  }

  // No source at all is not a failed load: show the tile immediately rather
  // than an <img> with an empty src, which some browsers treat as a fresh page
  // request. The admin panel clears a photo this way.
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "photo-fallback flex items-center justify-center overflow-hidden",
          className,
          fallbackClassName,
        )}
      >
        <Flame className={cn("text-gold/45", glyphClassName)} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
