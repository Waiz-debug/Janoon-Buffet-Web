import { Button } from "@/components/ui/button";
import { useCounterMedia, useLiveTable } from "@/hooks/use-live-db";
import { useAdminMenu } from "@/hooks/use-live-db";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  removeCounterImage,
  setCounterImage,
  replaceCounterImage,
} from "@/lib/db";
import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** One row per counter — uploads/replaces the hero image for that counter. */
export function CounterHeroManager() {
  const { categories } = useAdminMenu();
  const counterMediaRows = useCounterMedia() ?? [];
  const { isUploading, upload } = useImageUpload("counter-hero");

  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const bySlot = new Map<string, (typeof counterMediaRows)[number]>();
  for (const row of counterMediaRows) bySlot.set(row.slot, row);

  const publish = async (counterId: string, storageId: string, caption?: string) => {
    setBusySlot(counterId);
    try {
      // If a previous uploaded image exists, replace it (cleans up old storage object).
      const previous = bySlot.get(counterId);
      if (previous?.imageStorageId) {
        await replaceCounterImage(counterId, storageId, caption);
      } else {
        await setCounterImage(counterId, storageId, caption);
      }
      toast.success("Counter hero photo published — live on the site");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish the photo.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const reset = async (counterId: string) => {
    setBusySlot(counterId);
    try {
      await removeCounterImage(counterId);
      toast.success("Counter hero photo removed — the built-in fallback is back");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not clear the photo.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No counters yet. Create counters in the Counters tab first, then come
          back here to add hero photos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-base font-semibold">Counter hero photos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A hero image for each counter — the photo that tops its card on the
          public site. Upload once per counter; replacing it removes the previous
          image. A marker marked{" "}
          <span className="text-gold">Demo</span> means the counter is still
          showing its built-in fallback.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {categories.map((counter) => {
          const row = bySlot.get(counter.id);
          const caption = drafts[counter.id] ?? row?.caption ?? "";
          return (
            <div
              key={counter.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{counter.name}</p>
                  {counter.blurb ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {counter.blurb}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row?.demo !== false ? (
                    <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.6rem] text-gold">
                      Demo
                    </span>
                  ) : null}
                </div>
              </div>

              <span className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
                {row?.url ? (
                  <img
                    src={row.url}
                    alt={counter.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="px-3 text-center text-xs text-muted-foreground">
                    No hero photo uploaded yet
                  </span>
                )}
              </span>

              <input
                id={`counter-hero-input-${counter.id}`}
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
                      ? publish(counter.id, result.storageId, caption || undefined)
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
                    document.getElementById(`counter-hero-input-${counter.id}`)?.click()
                  }
                  className="gap-1.5"
                >
                  {busySlot === counter.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="size-3.5" aria-hidden />
                  )}
                  {row ? "Replace" : "Upload"}
                </Button>
                {row ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busySlot !== null}
                    onClick={() => void reset(counter.id)}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Reset
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`caption-${counter.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Caption (applied on next upload)
                </label>
                <input
                  id={`caption-${counter.id}`}
                  type="text"
                  value={caption}
                  placeholder="e.g. Seekh kebab off the coals"
                  onChange={(e) =>
                    setDrafts({ ...drafts, [counter.id]: e.target.value })
                  }
                  className="h-8 w-full rounded-md border border-border/70 bg-background/60 px-3 py-1 text-sm text-muted-foreground"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
