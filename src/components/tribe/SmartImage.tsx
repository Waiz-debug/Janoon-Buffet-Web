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

  if (failed) {
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
