import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MediaRow = {
  _id: string;
  slot: string;
  caption?: string;
  url?: string;
  imageStorageId?: string;
};

const GALLERY_SLOTS = [
  "gallery-1",
  "gallery-2",
  "gallery-3",
  "gallery-4",
  "gallery-5",
  "gallery-6",
] as const;

export function PhotoManager() {
  const mediaRows = (useQuery(api.menu.listSiteMedia) ?? []) as MediaRow[];
  const setSiteMedia = useMutation(api.menu.setSiteMedia);
  const clearSiteMedia = useMutation(api.menu.clearSiteMedia);
  const { isUploading, upload } = useImageUpload();

  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const bySlot = new Map<string, MediaRow>();
  for (const row of mediaRows) bySlot.set(row.slot, row);

  const publish = async (
    slot: string,
    result: {
      storageId: string;
      name: string;
      mimeType: string;
      bytes: number;
    },
    caption?: string,
  ) => {
    setBusySlot(slot);
    try {
      await setSiteMedia({
        slot,
        storageId: result.storageId as never,
        originalName: result.name,
        mimeType: result.mimeType,
        bytes: result.bytes,
        caption,
      });
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
      await clearSiteMedia({ slot });
      toast.success("Slot cleared — the themed default is back");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not clear the slot.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const hero = bySlot.get("hero");
  const galleryLabel = (slot: string) =>
    `Tile ${GALLERY_SLOTS.indexOf(slot as never) + 1}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero backdrop */}
      <div className="rounded-2xl border border-gold/30 bg-card/60 p-5">
        <h3 className="font-display text-base font-semibold">Hero backdrop</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The wide photo behind the landing hero. A real photo of the open-air
          seating at Natha Singh Wala works best here.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="flex h-32 w-full max-w-sm items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
            {hero?.url ? (
              <img
                src={hero.url}
                alt="Current hero backdrop"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-6 text-center text-xs text-muted-foreground">
                No custom photo yet — guests currently see the themed default
              </span>
            )}
          </span>

          <div className="flex flex-col gap-2">
            <input
              id="hero-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void upload(file).then((result) =>
                  result ? publish("hero", result) : undefined,
                );
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() =>
                document.getElementById("hero-photo-input")?.click()
              }
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-3.5" aria-hidden />
              )}
              {isUploading ? "Uploading…" : "Choose photo"}
            </Button>
            {hero ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void clearSlot("hero")}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="size-3.5" aria-hidden />
                Reset to default
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Gallery tiles */}
      <div>
        <h3 className="font-display text-base font-semibold">Gallery tiles</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The six tiles under “Recently plated” on the reviews section. Upload
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
