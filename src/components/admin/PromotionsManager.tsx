import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePromotions } from "@/hooks/use-live-db";
import {
  PROMO_DEFAULT_ORDER,
  deletePromotion,
  removePromotionImage,
  savePromotion,
  togglePromotion,
  uploadImage,
} from "@/lib/db";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Flame,
  ImagePlus,
  Link2,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Rows3,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type PromotionDraft = {
  title: string;
  headline: string;
  body: string;
  visible: boolean;
  expiresAtInput: string;
  /** The offer's button target — an in-app path or a full URL. */
  linkUrl: string;
  /** Board position, held as text so the field can be emptied while editing. */
  sortOrder: string;
  pendingStorageId: string | null;
  pendingPreviewUrl: string | null;
  imageRemoved: boolean;
};

const emptyDraft: PromotionDraft = {
  title: "",
  headline: "",
  body: "",
  visible: true,
  expiresAtInput: "",
  linkUrl: "",
  sortOrder: String(PROMO_DEFAULT_ORDER),
  pendingStorageId: null,
  pendingPreviewUrl: null,
  imageRemoved: false,
};

function parseExpiry(input: string): number | undefined {
  if (!input) return undefined;
  const t = new Date(input).getTime();
  return isNaN(t) ? undefined : t;
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromotionsManager() {
  const promos = usePromotions(false);

  const [draft, setDraft] = useState<PromotionDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read the clock from state and tick it, instead of calling Date.now() while
  // rendering (which makes the render impure and the expiry badge go stale).
  // Same 30-second beat the public banner counts down on.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const startCreate = () => {
    setDraft({ ...emptyDraft });
    setEditingId(null);
  };

  const startEdit = (promo: {
    _id: string;
    title: string;
    headline: string;
    body?: string;
    visible: boolean;
    imageUrl?: string;
    imagePath?: string;
    linkUrl?: string;
    sortOrder: number;
    expiresAt?: number;
  }) => {
    setDraft({
      title: promo.title,
      headline: promo.headline,
      body: promo.body ?? "",
      visible: promo.visible,
      expiresAtInput: promo.expiresAt ? toDatetimeLocal(promo.expiresAt) : "",
      linkUrl: promo.linkUrl ?? "",
      sortOrder: String(promo.sortOrder),
      pendingStorageId: null,
      pendingPreviewUrl: null,
      imageRemoved: false,
    });
    setEditingId(promo._id);
  };

  const handleImageSelect = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadImage(file, "promotions");
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              pendingStorageId: result.storageId,
              pendingPreviewUrl: result.url,
              imageRemoved: false,
            }
          : prev,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (editingId) {
      try {
        await removePromotionImage(editingId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not remove image.",
        );
        return;
      }
    }
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            pendingStorageId: null,
            pendingPreviewUrl: null,
            imageRemoved: true,
          }
        : prev,
    );
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.headline.trim()) {
      toast.error("Title and headline are required.");
      return;
    }
    setIsSaving(true);
    try {
      const expiresAt = parseExpiry(draft.expiresAtInput);

      // Send the link and the board position only when they actually carry a
      // value to write. A promotion with neither still saves on a database that
      // has not run the migration adding those two columns yet, so publishing a
      // banner never depends on it.
      const parsedOrder = Number.parseInt(draft.sortOrder, 10);
      const order = Number.isFinite(parsedOrder) ? parsedOrder : PROMO_DEFAULT_ORDER;
      const link = draft.linkUrl.trim();
      const current = editingId ? all.find((p) => p._id === editingId) : undefined;

      await savePromotion({
        id: editingId ?? undefined,
        title: draft.title,
        headline: draft.headline,
        body: draft.body || undefined,
        visible: draft.visible,
        imagePath: draft.pendingStorageId ?? undefined,
        // An empty field clears a link that used to be set, and is left out of
        // the write entirely when there was never one.
        linkUrl: link ? link : current?.linkUrl ? "" : undefined,
        sortOrder:
          order === (current?.sortOrder ?? PROMO_DEFAULT_ORDER)
            ? undefined
            : order,
        expiresAt,
      });
      toast.success(
        editingId
          ? "Promotion updated — live on the site"
          : draft.visible
            ? "Promotion published — live on the site"
            : "Promotion saved (hidden)",
      );
      setDraft(null);
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (id: string) => {
    setBusyId(id);
    try {
      const visible = await togglePromotion(id);
      toast.success(visible ? "Promotion is now live" : "Promotion hidden");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not toggle.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this promotion permanently?")) return;
    setBusyId(id);
    try {
      await deletePromotion(id);
      toast.success("Promotion deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const all = promos ?? [];

  const getEditorImageUrl = () => {
    if (!draft) return null;
    if (draft.imageRemoved) return null;
    if (draft.pendingPreviewUrl) return draft.pendingPreviewUrl;
    if (editingId) {
      const existing = all.find((p) => p._id === editingId);
      return existing?.imageUrl || null;
    }
    return null;
  };

  const editorImageUrl = getEditorImageUrl();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {all.length} promotion{all.length !== 1 ? "s" : ""} · changes go live
          instantly
        </p>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add promotion
        </Button>
      </div>

      <AnimatePresence>
        {draft ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">
                  {editingId ? "Edit promotion" : "New promotion"}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close editor"
                  onClick={() => {
                    setDraft(null);
                    setEditingId(null);
                  }}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-title">Admin label</Label>
                  <Input
                    id="promo-title"
                    value={draft.title}
                    placeholder="e.g. Eid Weekend Offer"
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="promo-expires">
                    Expires <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Clock
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="promo-expires"
                      type="datetime-local"
                      value={draft.expiresAtInput}
                      onChange={(e) =>
                        setDraft({ ...draft, expiresAtInput: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                  {draft.expiresAtInput && parseExpiry(draft.expiresAtInput) && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(draft.expiresAtInput).toLocaleDateString("en-PK", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — banner auto-removes at this time
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-headline">Banner headline</Label>
                  <Input
                    id="promo-headline"
                    value={draft.headline}
                    placeholder="e.g. Eid Special — Family of 4 eats for Rs 7,500"
                    onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-body">
                    Body text <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="promo-body"
                    rows={2}
                    value={draft.body}
                    placeholder="e.g. Valid Friday–Sunday, dine-in only."
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-link">
                    Action link{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Link2
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="promo-link"
                      value={draft.linkUrl}
                      placeholder="e.g. /#reserve or https://instagram.com/p/..."
                      onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Where the offer&apos;s button goes on the offers board and the
                    top banner. Leave empty to send customers to the buffet
                    booking form.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-order">
                    Board position{" "}
                    <span className="text-muted-foreground">(lower shows first)</span>
                  </Label>
                  <div className="relative">
                    <Rows3
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="promo-order"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft.sortOrder}
                      placeholder={String(PROMO_DEFAULT_ORDER)}
                      onChange={(e) =>
                        setDraft({ ...draft, sortOrder: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>
                    Banner image <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  {editorImageUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-border/70">
                      <img
                        src={editorImageUrl}
                        alt="Banner preview"
                        className="w-full object-cover"
                        style={{ maxHeight: 200 }}
                      />
                      <div className="absolute right-2 top-2 flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="gap-1.5 bg-background/80 backdrop-blur"
                        >
                          <Upload className="size-3.5" aria-hidden />
                          Replace
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveImage}
                          className="gap-1.5"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-card/30 p-8 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      {isUploading ? (
                        <Loader2 className="size-6 animate-spin" aria-hidden />
                      ) : (
                        <ImagePlus className="size-6" aria-hidden />
                      )}
                      <span className="text-sm">
                        {isUploading ? "Uploading…" : "Click to upload a banner graphic"}
                      </span>
                      <span className="text-xs">JPEG, PNG, WebP · max 5 MB</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                  <span className="text-sm">Visible on public site</span>
                  <Switch
                    checked={draft.visible}
                    onCheckedChange={(checked) => setDraft({ ...draft, visible: checked })}
                  />
                </label>
              </div>

              {draft.headline ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Preview — how customers will see it:
                  </p>
                  {editorImageUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-gold/20">
                      <img
                        src={editorImageUrl}
                        alt="Banner background"
                        className="w-full object-cover"
                        style={{ maxHeight: 160 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-4 text-center">
                        <div>
                          <p className="text-sm font-bold text-white sm:text-base">
                            {draft.headline}
                          </p>
                          {draft.body && (
                            <p className="mt-1 text-xs text-white/80">{draft.body}</p>
                          )}
                          {draft.expiresAtInput && parseExpiry(draft.expiresAtInput) && (
                            <p className="mt-1.5 text-xs text-gold">
                              Expires{" "}
                              {new Date(draft.expiresAtInput).toLocaleDateString("en-PK", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-r from-gold/10 via-gold/[0.06] to-ember/10">
                      <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-center">
                        <Flame className="size-3.5 shrink-0 text-gold" aria-hidden />
                        <p className="text-xs font-medium sm:text-sm">
                          <span className="font-semibold">{draft.headline}</span>
                          {draft.body ? <> — {draft.body}</> : null}
                          {draft.expiresAtInput && parseExpiry(draft.expiresAtInput) && (
                            <span className="ml-2 text-gold">
                              · Expires{" "}
                              {new Date(draft.expiresAtInput).toLocaleDateString("en-PK", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => { setDraft(null); setEditingId(null); }}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Megaphone className="size-4" aria-hidden />
                  )}
                  {editingId ? "Save changes" : "Publish"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col gap-3">
        {all.map((promo) => {
          const isExpired = promo.expiresAt && promo.expiresAt < now;
          return (
            <div
              key={promo._id}
              className={`flex flex-col gap-3 rounded-2xl border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between ${
                isExpired ? "border-border/40 opacity-60" : "border-border/70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {promo.imageUrl ? (
                    <img src={promo.imageUrl} alt="" className="size-8 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
                      <Flame className="size-4 text-gold" aria-hidden />
                    </span>
                  )}
                  <p className="truncate text-sm font-semibold">{promo.title}</p>
                  {!promo.visible && (
                    <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.6rem] text-muted-foreground">
                      Hidden
                    </span>
                  )}
                  {isExpired && (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[0.6rem] text-red-400">
                      Expired
                    </span>
                  )}
                  <span className="shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[0.6rem] text-muted-foreground">
                    #{promo.sortOrder}
                  </span>
                  {promo.linkUrl ? (
                    <Link2
                      className="size-3 shrink-0 text-gold/70"
                      aria-label={`Links to ${promo.linkUrl}`}
                    />
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {promo.headline}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {promo.body && <span className="truncate">{promo.body}</span>}
                  {promo.expiresAt && (
                    <span className="flex shrink-0 items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      {isExpired
                        ? "Expired"
                        : `Expires ${new Date(promo.expiresAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === promo._id}
                  onClick={() => toggle(promo._id)}
                  className="gap-1.5"
                >
                  {promo.visible ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === promo._id}
                  aria-label={`Edit ${promo.title}`}
                  onClick={() => startEdit(promo)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === promo._id}
                  aria-label={`Delete ${promo.title}`}
                  onClick={() => remove(promo._id)}
                >
                  <Trash2 className="size-3.5 text-destructive" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}

        {all.length === 0 && !draft ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
            <Megaphone className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              No promotions yet. Create one to broadcast a banner to all visitors.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
