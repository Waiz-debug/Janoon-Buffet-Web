import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Loader2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Accent = "gold" | "emerald" | "ember";

type PromotionDraft = {
  title: string;
  headline: string;
  body: string;
  accent: Accent;
  visible: boolean;
};

const emptyDraft: PromotionDraft = {
  title: "",
  headline: "",
  body: "",
  accent: "gold",
  visible: true,
};

const ACCENT_PRESETS: Record<Accent, { label: string; preview: string }> = {
  gold: {
    label: "Gold",
    preview:
      "border-gold/20 bg-gradient-to-r from-gold/10 via-gold/[0.06] to-ember/10 text-gold",
  },
  emerald: {
    label: "Green",
    preview:
      "border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/[0.06] to-emerald-500/5 text-emerald-400",
  },
  ember: {
    label: "Red",
    preview:
      "border-red-500/20 bg-gradient-to-r from-red-500/10 via-red-500/[0.06] to-red-500/5 text-red-400",
  },
};

const ACCENT_COLORS: Record<Accent, string> = {
  gold: "text-gold",
  emerald: "text-emerald-400",
  ember: "text-red-400",
};

export function PromotionsManager() {
  const promos = useQuery(api.promotions.listAll);
  const createPromo = useMutation(api.promotions.create);
  const updatePromo = useMutation(api.promotions.update);
  const toggleVis = useMutation(api.promotions.toggleVisibility);
  const removePromo = useMutation(api.promotions.remove);

  const [draft, setDraft] = useState<PromotionDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const startCreate = () => {
    setDraft({ ...emptyDraft });
    setEditingId(null);
  };

  const startEdit = (promo: {
    _id: string;
    title: string;
    headline: string;
    body?: string;
    accent: Accent;
    visible: boolean;
  }) => {
    setDraft({
      title: promo.title,
      headline: promo.headline,
      body: promo.body ?? "",
      accent: promo.accent,
      visible: promo.visible,
    });
    setEditingId(promo._id);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.headline.trim()) {
      toast.error("Title and headline are required.");
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updatePromo({
          id: editingId as never,
          title: draft.title,
          headline: draft.headline,
          body: draft.body || undefined,
          accent: draft.accent,
          visible: draft.visible,
        });
        toast.success("Promotion updated — live on the site");
      } else {
        await createPromo({
          title: draft.title,
          headline: draft.headline,
          body: draft.body || undefined,
          accent: draft.accent,
          visible: draft.visible,
        });
        toast.success(
          draft.visible
            ? "Promotion published — live on the site"
            : "Promotion saved (hidden)",
        );
      }
      setDraft(null);
      setEditingId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (id: string) => {
    setBusyId(id);
    try {
      const result = await toggleVis({ id: id as never });
      toast.success(result.visible ? "Promotion is now live" : "Promotion hidden");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not toggle.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this promotion permanently?")) return;
    setBusyId(id);
    try {
      await removePromo({ id: id as never });
      toast.success("Promotion deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const all = promos ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {all.length} promotion{all.length !== 1 ? "s" : ""} · changes go live
          instantly
        </p>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          New promotion
        </Button>
      </div>

      {/* Editor */}
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
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Accent colour</Label>
                  <div className="flex gap-2">
                    {(Object.keys(ACCENT_PRESETS) as Accent[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDraft({ ...draft, accent: key })}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                          draft.accent === key
                            ? "border-foreground/40 bg-foreground/10"
                            : "border-border/70 hover:border-foreground/20"
                        }`}
                      >
                        <span
                          className={`size-3 rounded-full ${
                            key === "gold"
                              ? "bg-gold"
                              : key === "emerald"
                                ? "bg-emerald-500"
                                : "bg-red-500"
                          }`}
                          aria-hidden
                        />
                        {ACCENT_PRESETS[key].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-headline">Banner headline</Label>
                  <Input
                    id="promo-headline"
                    value={draft.headline}
                    placeholder="e.g. Eid Special — Family of 4 eats for Rs 7,500"
                    onChange={(e) =>
                      setDraft({ ...draft, headline: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="promo-body">
                    Body text{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="promo-body"
                    rows={2}
                    value={draft.body}
                    placeholder="e.g. Valid Friday–Sunday, dine-in only. Book your table now!"
                    onChange={(e) =>
                      setDraft({ ...draft, body: e.target.value })
                    }
                  />
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                  <span className="text-sm">Visible on public site</span>
                  <Switch
                    checked={draft.visible}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, visible: checked })
                    }
                  />
                </label>
              </div>

              {/* Live preview */}
              {draft.headline ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Preview — how customers will see it:
                  </p>
                  <div
                    className={`overflow-hidden rounded-xl border bg-gradient-to-r ${ACCENT_PRESETS[draft.accent].preview}`}
                  >
                    <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-center">
                      <Flame
                        className={`size-3.5 shrink-0 ${ACCENT_COLORS[draft.accent]}`}
                        aria-hidden
                      />
                      <p className="text-xs font-medium sm:text-sm">
                        <span className="font-semibold">{draft.headline}</span>
                        {draft.body ? (
                          <>
                            {" "}
                            — {draft.body}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(null);
                    setEditingId(null);
                  }}
                >
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

      {/* Promotions list */}
      <div className="flex flex-col gap-3">
        {all.map((promo) => (
          <div
            key={promo._id}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    promo.accent === "gold"
                      ? "bg-gold"
                      : promo.accent === "emerald"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                  }`}
                  aria-hidden
                />
                <p className="truncate text-sm font-semibold">{promo.title}</p>
                {!promo.visible && (
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.6rem] text-muted-foreground">
                    Hidden
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {promo.headline}
              </p>
              {promo.body ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {promo.body}
                </p>
              ) : null}
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
        ))}

        {all.length === 0 && !draft ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
            <Megaphone
              className="mx-auto mb-3 size-6 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              No promotions yet. Create one to broadcast a banner to all
              visitors.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
