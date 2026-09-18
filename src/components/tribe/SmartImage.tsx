import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { useState } from "react";

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Extra classes for the themed tile shown when the photo cannot load. */
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
};

/**
 * Photo with a dignified heritage fallback: if the image fails to load the tile
 * becomes a warm ember gradient with a flame mark, so the layout still reads as
 * an intentional part of the design instead of a broken image.
 */
export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
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
          "flex items-center justify-center bg-gradient-to-br from-clay/40 via-card to-background",
          className,
          fallbackClassName,
        )}
      >
        <Flame className="size-8 text-gold/40" aria-hidden />
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
