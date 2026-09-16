import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteMedia } from "@/hooks/use-live-db";
import { useImageUpload } from "@/hooks/use-image-upload";
import { clearSiteMedia, setSiteMedia } from "@/lib/db";
import { GALLERY } from "@/lib/restaurant";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The six gallery slots, in order. These map one-to-one onto the tiles in the
 * public "Gallery" section — there are exactly six, so the admin list and the
 * guest-facing grid can never drift apart.
 */
const GALLERY_SLOTS = [
  "gallery-1",
  "gallery-2",
  "gallery-3",
  "gallery-4",
  "gallery-5",
  "gallery-6",
] as const;

const slotIndex = (slot: string) => Number(slot.replace("gallery-", "")) || 0;

/** The built-in photo each slot falls back to before an upload. */
const defaultFor = (slot: string) => GALLERY[slotIndex(slot) - 1];

export function PhotoManager() {
  const mediaRows = useSiteMedia() ?? [];
  const { isUploading, upload } = useImageUpload("gallery");

  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const bySlot = new Map<string, (typeof mediaRows)[number]>();
  for (const row of mediaRows) bySlot.set(row.slot, row);

  const publish = async (
    slot: string,
    result: { storageId: string },
    caption?: string,
  ) => {
    setBusySlot(slot);
    try {
      await setSiteMedia(slot, result.storageId, caption);
      toast.success("Photo published — live in the gallery");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish the photo.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const clearSlot = async (slot: string) => {
    setBusySlot(slot);
    try {
      await clearSiteMedia(slot);
      toast.success("Slot cleared — the built-in photo is back");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not clear the slot.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-base font-semibold">Gallery tiles</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The six tiles in the public <span className="text-gold">Gallery</span>{" "}
          section and nowhere else. These are the same images guests see, so
          anything you change here appears on the site the moment it saves. A
          tile marked <span className="text-gold">Demo</span> is still a stock
          placeholder waiting for a real photo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY_SLOTS.map((slot) => {
          const row = bySlot.get(slot);
          const fallback = defaultFor(slot);
          return (
            <div
              key={slot}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4"
            >
              <span className="flex items-center gap-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">
                Tile {slotIndex(slot)}
                {row?.demo ? (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.6rem] tracking-normal text-gold normal-case">
                    Demo
                  </span>
                ) : null}
              </span>

              <span className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
                {row?.url ? (
                  <img
                    src={row.url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="px-3 text-center text-xs text-muted-foreground">
                    {fallback
                      ? `No upload — the built-in photo is showing`
                      : "Upload a photo to publish this tile"}
                  </span>
                )}
              </span>

              <input
                id={`gallery-input-${slot}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="sr-only"
                disabled={isUploading || busySlot !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void upload(file).then((result) =>
                    result
                      ? publish(slot, result, captions[slot]?.trim() || undefined)
                      : undefined,
                  );
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading || busySlot !== null}
                  onClick={() =>
                    document.getElementById(`gallery-input-${slot}`)?.click()
                  }
                  className="gap-1.5"
                >
                  {busySlot === slot ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="size-3.5" aria-hidden />
                  )}
                  {row ? "Replace" : "Choose"}
                </Button>
                {row ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busySlot !== null}
                    onClick={() => void clearSlot(slot)}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
                    Reset
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`caption-${slot}`} className="text-xs">
                  Caption (applied on next upload)
                </Label>
                <Input
                  id={`caption-${slot}`}
                  value={captions[slot] ?? row?.caption ?? fallback?.caption ?? ""}
                  placeholder="e.g. Seekh kebab off the coals"
                  onChange={(e) =>
                    setCaptions({ ...captions, [slot]: e.target.value })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
