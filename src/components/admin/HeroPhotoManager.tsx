import { Button } from "@/components/ui/button";
import { useSiteMedia } from "@/hooks/use-live-db";
import { useImageUpload } from "@/hooks/use-image-upload";
import { clearSiteMedia, setSiteMedia } from "@/lib/db";
import { HERO_MEDIA } from "@/lib/restaurant";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The backdrop behind the hero headline — the first photo a guest sees. It is
 * the `hero` slot in `site_media`, so publishing here updates the top of the
 * public site live, and resetting drops back to the built-in photo.
 */
export function HeroPhotoManager() {
  const mediaRows = useSiteMedia() ?? [];
  const { isUploading, upload } = useImageUpload(HERO_MEDIA.slot);
  const [busy, setBusy] = useState(false);

  const row = mediaRows.find((media) => media.slot === HERO_MEDIA.slot);
  const inputId = `site-media-input-${HERO_MEDIA.slot}`;

  const publish = async (storageId: string) => {
    setBusy(true);
    try {
      await setSiteMedia(HERO_MEDIA.slot, storageId);
      toast.success("Hero photo published — live on the site");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish the photo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await clearSiteMedia(HERO_MEDIA.slot);
      toast.success("Reset — the built-in hero photo is back");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reset the photo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-semibold">
          {HERO_MEDIA.label}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {HERO_MEDIA.hint} Publishing replaces the built-in stock photo
          instantly; guests see the new backdrop without a reload.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
            {row ? "Published" : "Built-in photo"}
          </span>
          {row?.demo ? (
            <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.6rem] text-gold">
              Demo
            </span>
          ) : null}
        </div>

        <span className="flex aspect-[16/6] items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
          <img
            src={row?.url ?? HERO_MEDIA.url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        </span>

        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          disabled={isUploading || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void upload(file).then((result) =>
              result ? publish(result.storageId) : undefined,
            );
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading || busy}
            onClick={() => document.getElementById(inputId)?.click()}
            className="gap-1.5"
          >
            {busy || isUploading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden />
            )}
            {row ? "Replace photo" : "Upload photo"}
          </Button>
          {row ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || isUploading}
              onClick={() => void reset()}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
