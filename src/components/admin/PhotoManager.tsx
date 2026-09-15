import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteMedia } from "@/hooks/use-live-db";
import { useImageUpload } from "@/hooks/use-image-upload";
import { clearSiteMedia, setSiteMedia } from "@/lib/db";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const GALLERY_SLOTS = [
  "gallery-1",
  "gallery-2",
  "gallery-3",
  "gallery-4",
  "gallery-5",
  "gallery-6",
] as const;

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
      toast.success("Photo published — live on the site");
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
      toast.success("Slot cleared — the themed default is back");
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
      {/* Gallery tiles */}
      <div>
        <h3 className="font-display text-base font-semibold">Gallery tiles</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The six tiles under "Recently plated" on the reviews section. Upload
          real photos of dishes and the terrace to replace the defaults.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_SLOTS.map((slot, index) => {
            const row = bySlot.get(slot);
            return (
              <div
                key={slot}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4"
              >
                <span className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                  Tile {index + 1}
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
                      Default in use — upload to replace
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
                <div className="flex items-center gap-2">
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
                    Choose
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
                    value={captions[slot] ?? ""}
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
    </div>
  );
}
