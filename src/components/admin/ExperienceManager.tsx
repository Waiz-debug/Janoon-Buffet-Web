import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteContent, useSiteMedia } from "@/hooks/use-live-db";
import { useImageUpload } from "@/hooks/use-image-upload";
import { clearSiteMedia, setSiteContent, setSiteMedia } from "@/lib/db";
import { EXPERIENCE_MEDIA, SITE_CONTENT_DEFAULTS } from "@/lib/restaurant";
import { Check, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** The two showcase photos, in the order they appear on the public page. */
const PHOTOS = [EXPERIENCE_MEDIA.ambiance, EXPERIENCE_MEDIA.food];

/** Editable copy, with its label and the built-in value as the placeholder. */
const FIELDS = [
  {
    key: "experience-seats" as const,
    label: "Seating counter",
    placeholder: SITE_CONTENT_DEFAULTS["experience-seats"],
  },
  {
    key: "experience-seats-label" as const,
    label: "Seating caption",
    placeholder: SITE_CONTENT_DEFAULTS["experience-seats-label"],
  },
];

/**
 * "The Experience" section on the public site: the large ambiance photo, the
 * food & grill photo beneath it, and the seating counter. Every part of this
 * panel writes straight to Supabase, so the guest-facing section updates live.
 */
export function ExperienceManager() {
  const mediaRows = useSiteMedia() ?? [];
  const contentRows = useSiteContent() ?? [];
  const { isUploading, upload } = useImageUpload("experience");

  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  /** Uncommitted text, keyed by `site_content` key. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const bySlot = new Map(mediaRows.map((row) => [row.slot, row]));
  const savedContent = new Map(contentRows.map((row) => [row.key, row.value]));

  const valueOf = (key: string) =>
    drafts[key] ?? savedContent.get(key) ?? "";

  const publish = async (slot: string, storageId: string) => {
    setBusySlot(slot);
    try {
      await setSiteMedia(slot, storageId);
      toast.success("Photo published — live on the site");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish the photo.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const reset = async (slot: string) => {
    setBusySlot(slot);
    try {
      await clearSiteMedia(slot);
      toast.success("Reset — the built-in photo is back");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reset the photo.",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const saveText = async (key: string) => {
    const value = valueOf(key).trim();
    if (!value) {
      toast.error("That line cannot be empty.");
      return;
    }
    setSavingKey(key);
    try {
      await setSiteContent(key, value);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success("Saved — live on the site");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save that text.",
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-base font-semibold">
          The Experience section
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The showcase photos and the seating counter in the &ldquo;The
          Experience&rdquo; block on the public site. Uploads replace the
          built-in stock photo; leaving a slot alone keeps it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PHOTOS.map((photo) => {
          const row = bySlot.get(photo.slot);
          return (
            <div
              key={photo.slot}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{photo.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {photo.hint}
                  </p>
                </div>
                {row?.demo ? (
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.6rem] text-gold">
                    Demo
                  </span>
                ) : null}
              </div>

              <span className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
                <img
                  src={row?.url ?? photo.url}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              </span>

              <input
                id={`experience-input-${photo.slot}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="sr-only"
                disabled={isUploading || busySlot !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void upload(file).then((result) =>
                    result ? publish(photo.slot, result.storageId) : undefined,
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
                    document.getElementById(`experience-input-${photo.slot}`)?.click()
                  }
                  className="gap-1.5"
                >
                  {busySlot === photo.slot ? (
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
                    disabled={busySlot !== null}
                    onClick={() => void reset(photo.slot)}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-4">
        <div>
          <p className="text-sm font-semibold">Seating counter</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The highlighted figure and its caption next to the grill photo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const current = valueOf(field.key);
            const dirty = drafts[field.key] !== undefined;
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  value={current}
                  placeholder={field.placeholder}
                  disabled={savingKey !== null}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingKey !== null || !dirty}
                    onClick={() => void saveText(field.key)}
                    className="gap-1.5"
                  >
                    {savingKey === field.key ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    Save
                  </Button>
                  {dirty ? (
                    <span className="text-xs text-muted-foreground">
                      Unsaved change
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
