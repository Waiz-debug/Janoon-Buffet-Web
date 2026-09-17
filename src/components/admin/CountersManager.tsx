import { ImageField } from "@/components/admin/ImageField";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCategory,
  deleteDish,
  removeDishImage,
  setDishImage,
  upsertCategory,
  upsertDish,
  type MenuDishRow,
} from "@/lib/db";
import { SIGNATURE_LIMIT, formatRupees } from "@/lib/menu";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CategoryIcon = keyof typeof CATEGORY_ICONS;

/** One counter (category) as the admin panel sees it. */
export type CounterOption = {
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIcon;
  sortOrder: number;
  active: boolean;
};

type CounterDraft = {
  id: string | null;
  name: string;
  urdu: string;
  blurb: string;
  icon: CategoryIcon;
  active: boolean;
};

type DishDraft = {
  slug: string | null;
  name: string;
  urdu: string;
  counterId: string;
  summary: string;
  description: string;
  pricePerPlate: string;
  image: string;
  /** Storage id of a just-uploaded photo awaiting the first save. */
  pendingStorageId: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};

const emptyDish = (counterId: string, nextSort: number): DishDraft => ({
  slug: null,
  name: "",
  urdu: "",
  counterId,
  summary: "",
  description: "",
  pricePerPlate: "",
  image: "",
  pendingStorageId: null,
  active: true,
  featured: false,
  sortOrder: nextSort,
});

/**
 * Counters and the items that belong to them, on one screen.
 *
 * A counter is a section of the menu — BBQ & Grills, Traditional Handi,
 * Tandoor, anything the owner invents. Each counter lists its own items with an
 * "Add item" button right on its heading, so building a section is: create the
 * counter, then add its dishes without leaving the block. Nothing else to fill
 * in — the counter id and every item's position are derived on save.
 *
 * Everything here writes straight to Supabase and rides the shared realtime
 * channel, so a save is on the guest's screen the moment it lands.
 */
export function CountersManager({
  categories,
  dishes,
}: {
  categories: CounterOption[];
  dishes: MenuDishRow[];
}) {
  const [counterDraft, setCounterDraft] = useState<CounterDraft | null>(null);
  const [dishDraft, setDishDraft] = useState<DishDraft | null>(null);
  const [savingCounter, setSavingCounter] = useState(false);
  const [savingDish, setSavingDish] = useState(false);
  const [deletingCounter, setDeletingCounter] = useState<string | null>(null);
  const [deletingDish, setDeletingDish] = useState<string | null>(null);

  const signatureCount = dishes.filter((dish) => dish.featured).length;
  const alreadyFeatured = Boolean(
    dishDraft?.slug && dishes.find((dish) => dish.slug === dishDraft.slug)?.featured,
  );
  const signatureFull =
    signatureCount >= SIGNATURE_LIMIT && !dishDraft?.featured;

  /**
   * Counters in menu order, followed by any counter an item still points at so
   * a stray row can never disappear from the panel.
   */
  const counters = useMemo<CounterOption[]>(() => {
    const list = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const known = new Set(list.map((counter) => counter.id));
    const orphans = [...new Set(dishes.map((dish) => dish.categoryId))]
      .filter((id) => id && !known.has(id))
      .map((id, index) => ({
        id,
        name: id === "uncategorized" ? "Uncategorized" : id,
        icon: "flame" as CategoryIcon,
        sortOrder: 900 + index,
        active: false,
      }));
    return [...list, ...orphans];
  }, [categories, dishes]);

  const itemsIn = (counterId: string) =>
    dishes
      .filter((dish) => dish.categoryId === counterId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  /* --------------------------------------------------------- counter ----- */

  const startCreateCounter = () => {
    setCounterDraft({
      id: null,
      name: "",
      urdu: "",
      blurb: "",
      icon: "flame",
      active: true,
    });
  };

  const startEditCounter = (counter: CounterOption) => {
    setCounterDraft({
      id: counter.id,
      name: counter.name,
      urdu: counter.urdu ?? "",
      blurb: counter.blurb ?? "",
      icon: counter.icon,
      active: counter.active,
    });
  };

  const saveCounter = async () => {
    if (!counterDraft) return;
    if (counterDraft.name.trim().length < 2) {
      toast.error("Give the counter a name first.");
      return;
    }
    setSavingCounter(true);
    try {
      const result = await upsertCategory({
        id: counterDraft.id ?? undefined,
        name: counterDraft.name,
        urdu: counterDraft.urdu,
        blurb: counterDraft.blurb,
        icon: counterDraft.icon,
        sortOrder: counterDraft.id
          ? categories.find((counter) => counter.id === counterDraft.id)?.sortOrder
          : categories.reduce(
              (max, counter) => Math.max(max, counter.sortOrder),
              0,
            ) + 1,
        active: counterDraft.active,
      });
      toast.success(
        result.created
          ? `${counterDraft.name.trim()} counter added — add its items now`
          : `${counterDraft.name.trim()} updated`,
      );
      setCounterDraft(null);
      // Straight into a new item for the counter just created.
      if (result.created) setDishDraft(emptyDish(result.id, 1));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the counter.",
      );
    } finally {
      setSavingCounter(false);
    }
  };

  const removeCounter = async (counter: CounterOption) => {
    if (
      !window.confirm(
        `Delete the ${counter.name} counter? Its items move to uncategorized and disappear from the public menu until you reassign them.`,
      )
    ) {
      return;
    }
    setDeletingCounter(counter.id);
    try {
      await deleteCategory(counter.id);
      toast.success(`${counter.name} deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the counter.",
      );
    } finally {
      setDeletingCounter(null);
    }
  };

  /* ------------------------------------------------------------ item ----- */

  const startCreateDish = (counterId?: string) => {
    const target = counterId ?? counters[0]?.id ?? "";
    const nextSort =
      itemsIn(target).reduce((max, dish) => Math.max(max, dish.sortOrder ?? 0), 0) +
      1;
    setDishDraft(emptyDish(target, nextSort));
  };

  const startEditDish = (dish: MenuDishRow) => {
    setDishDraft({
      slug: dish.slug,
      name: dish.name,
      urdu: dish.urdu ?? "",
      counterId: dish.categoryId,
      summary: dish.summary ?? "",
      description: dish.description ?? "",
      pricePerPlate: dish.pricePerPlate ? String(dish.pricePerPlate) : "",
      image: dish.image ?? "",
      pendingStorageId: null,
      active: dish.active ?? true,
      featured: dish.featured ?? false,
      sortOrder: dish.sortOrder ?? 1,
    });
  };

  const saveDish = async () => {
    if (!dishDraft) return;
    if (dishDraft.name.trim().length < 2) {
      toast.error("Give the item a name first.");
      return;
    }
    if (
      dishDraft.featured &&
      !alreadyFeatured &&
      signatureCount >= SIGNATURE_LIMIT
    ) {
      toast.error(`Only ${SIGNATURE_LIMIT} signature dishes are allowed.`, {
        description: "Turn one off before featuring another.",
      });
      return;
    }
    setSavingDish(true);
    try {
      const result = await upsertDish({
        slug: dishDraft.slug ?? undefined,
        name: dishDraft.name.trim(),
        urdu: dishDraft.urdu.trim() || undefined,
        categoryId: dishDraft.counterId,
        summary: dishDraft.summary.trim() || undefined,
        description: dishDraft.description.trim() || undefined,
        image: dishDraft.pendingStorageId
          ? undefined
          : dishDraft.image.trim() || undefined,
        imagePath: dishDraft.pendingStorageId ?? undefined,
        active: dishDraft.active,
        featured: dishDraft.featured,
        sortOrder: dishDraft.sortOrder,
        pricePerPlate: dishDraft.pricePerPlate
          ? Math.max(0, Math.round(Number(dishDraft.pricePerPlate)))
          : undefined,
      });
      toast.success(
        result.updated
          ? `${dishDraft.name.trim()} updated — live on the site`
          : `${dishDraft.name.trim()} added to the menu`,
      );
      setDishDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the item.",
      );
    } finally {
      setSavingDish(false);
    }
  };

  const removeDish = async (dish: MenuDishRow) => {
    if (
      !window.confirm(
        `Remove ${dish.name} from the public menu? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingDish(dish.slug);
    try {
      await deleteDish(dish.slug);
      toast.success(`${dish.name} removed from the menu`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the item.",
      );
    } finally {
      setDeletingDish(null);
    }
  };

  const counterName =
    counters.find((counter) => counter.id === dishDraft?.counterId)?.name ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {counters.length} {counters.length === 1 ? "counter" : "counters"} ·{" "}
          {dishes.length} items · changes go live instantly
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={startCreateCounter} className="gap-2">
            <Plus className="size-4" aria-hidden />
            New counter
          </Button>
          <Button onClick={() => startCreateDish()} className="gap-2">
            <Plus className="size-4" aria-hidden />
            New item
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- counter editor --- */}
      {counterDraft ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {counterDraft.id ? `Edit ${counterDraft.name}` : "New counter"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close counter editor"
              onClick={() => setCounterDraft(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A section of the menu — like &ldquo;Tandoor&rdquo; or &ldquo;BBQ
            &amp; Grills&rdquo;. Add its items underneath it once it exists.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="counter-name">Name</Label>
              <Input
                id="counter-name"
                value={counterDraft.name}
                placeholder="e.g. Tandoor"
                onChange={(e) =>
                  setCounterDraft({ ...counterDraft, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="counter-urdu">Urdu name</Label>
              <Input
                id="counter-urdu"
                dir="rtl"
                lang="ur"
                value={counterDraft.urdu}
                placeholder="e.g. تندور"
                onChange={(e) =>
                  setCounterDraft({ ...counterDraft, urdu: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="counter-blurb">Description (optional)</Label>
              <Textarea
                id="counter-blurb"
                rows={2}
                value={counterDraft.blurb}
                onChange={(e) =>
                  setCounterDraft({ ...counterDraft, blurb: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex gap-2">
                {(Object.keys(CATEGORY_ICONS) as CategoryIcon[]).map((icon) => {
                  const Icon = CATEGORY_ICONS[icon];
                  const active = counterDraft.icon === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCounterDraft({ ...counterDraft, icon })}
                      className={
                        active
                          ? "flex size-11 items-center justify-center rounded-xl border border-gold/50 bg-gold/15 text-gold"
                          : "flex size-11 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:border-gold/30"
                      }
                    >
                      <Icon className="size-5" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 self-end rounded-xl border border-border/70 px-4 py-3">
              <span className="text-sm">Visible on the public menu</span>
              <Switch
                checked={counterDraft.active}
                onCheckedChange={(checked) =>
                  setCounterDraft({ ...counterDraft, active: checked })
                }
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setCounterDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveCounter} disabled={savingCounter} className="gap-2">
              {savingCounter ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {counterDraft.id ? "Save changes" : "Create counter"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------- item editor --- */}
      {dishDraft ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {dishDraft.slug
                ? `Edit ${dishDraft.name}`
                : counterName
                  ? `New item in ${counterName}`
                  : "New item"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close item editor"
              onClick={() => setDishDraft(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-name">Name</Label>
              <Input
                id="dish-name"
                value={dishDraft.name}
                placeholder="e.g. Mutton Chop"
                onChange={(e) =>
                  setDishDraft({ ...dishDraft, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-urdu">Urdu name (optional)</Label>
              <Input
                id="dish-urdu"
                dir="rtl"
                lang="ur"
                value={dishDraft.urdu}
                onChange={(e) =>
                  setDishDraft({ ...dishDraft, urdu: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-price">Delivery price (Rs per plate)</Label>
              <Input
                id="dish-price"
                type="number"
                min={0}
                value={dishDraft.pricePerPlate}
                placeholder="e.g. 850"
                onChange={(e) =>
                  setDishDraft({ ...dishDraft, pricePerPlate: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Shown as the per-plate delivery price; included in the dine-in
                buffet either way.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Counter</Label>
              <div className="flex flex-wrap gap-2 pb-1">
                {counters.map((counter) => {
                  const active = dishDraft.counterId === counter.id;
                  return (
                    <button
                      key={counter.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDishDraft({ ...dishDraft, counterId: counter.id })
                      }
                      className={
                        active
                          ? "rounded-full border border-gold/50 bg-gold/15 px-3 py-1.5 text-xs text-gold"
                          : "rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/30"
                      }
                    >
                      {counter.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dish-summary">One-line summary</Label>
              <Input
                id="dish-summary"
                value={dishDraft.summary}
                placeholder="Hand-pressed minced beef, grilled over open charcoal."
                onChange={(e) =>
                  setDishDraft({ ...dishDraft, summary: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dish-description">Full description</Label>
              <Textarea
                id="dish-description"
                rows={3}
                value={dishDraft.description}
                onChange={(e) =>
                  setDishDraft({ ...dishDraft, description: e.target.value })
                }
              />
            </div>

            <ImageField
              label="Item photo"
              value={dishDraft.image}
              hint="JPG, PNG or WebP up to 5 MB"
              onUploaded={(upload) => {
                // Editing an existing dish: attach immediately (returns the
                // storage URL). Creating: hold a preview until the dish is
                // saved, then the URL is persisted with the form.
                if (dishDraft.slug) {
                  void setDishImage(dishDraft.slug, upload.storageId)
                    .then((url) => setDishDraft({ ...dishDraft, image: url }))
                    .catch(() => toast.error("Could not attach the photo."));
                } else {
                  setDishDraft({
                    ...dishDraft,
                    image: upload.previewUrl,
                    pendingStorageId: upload.storageId,
                  });
                }
              }}
              onCleared={() => {
                if (dishDraft.slug) {
                  void removeDishImage(dishDraft.slug).catch(() =>
                    toast.error("Could not remove the photo."),
                  );
                }
                setDishDraft({ ...dishDraft, image: "", pendingStorageId: null });
              }}
            />

            <div className="flex flex-col justify-center gap-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">Visible on the public menu</span>
                <Switch
                  checked={dishDraft.active}
                  onCheckedChange={(checked) =>
                    setDishDraft({ ...dishDraft, active: checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">
                  Signature
                  <span className="block text-xs text-muted-foreground">
                    {signatureCount} of {SIGNATURE_LIMIT} used · Signature section
                    only
                  </span>
                </span>
                <Switch
                  checked={dishDraft.featured}
                  disabled={signatureFull}
                  onCheckedChange={(checked) =>
                    setDishDraft({ ...dishDraft, featured: checked })
                  }
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDishDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDish} disabled={savingDish} className="gap-2">
              {savingDish ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {dishDraft.slug ? "Save changes" : "Add to counter"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------ counters + items --- */}
      {counters.map((counter) => {
        const Icon = CATEGORY_ICONS[counter.icon] ?? CATEGORY_ICONS.flame;
        const items = itemsIn(counter.id);
        return (
          <div key={counter.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2.5 text-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="font-medium">{counter.name}</span>
                {counter.urdu ? (
                  <span className="text-xs text-gold/60" dir="rtl" lang="ur">
                    {counter.urdu}
                  </span>
                ) : null}
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                <span
                  className={
                    counter.active
                      ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] text-emerald-300"
                      : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                  }
                >
                  {counter.active ? "Live" : "Hidden"}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => startCreateDish(counter.id)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add item
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${counter.name}`}
                  onClick={() => startEditCounter(counter)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${counter.name}`}
                  disabled={deletingCounter === counter.id}
                  onClick={() => removeCounter(counter)}
                >
                  {deletingCounter === counter.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                Nothing in this counter yet — use{" "}
                <span className="text-foreground">Add item</span> to build it.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-sm">
                  <thead className="bg-card/60 text-left text-xs tracking-[0.14em] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Urdu
                      </th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {items.map((dish) => (
                      <tr key={dish.slug} className="bg-card/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60 text-base">
                              {dish.image ? (
                                <img
                                  src={dish.image}
                                  alt=""
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span aria-hidden>🍽</span>
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {dish.name}
                              </span>
                              {dish.featured ? (
                                <span className="block text-[0.65rem] text-gold/70">
                                  Signature
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td
                          className="hidden px-4 py-3 text-muted-foreground sm:table-cell"
                          dir="rtl"
                          lang="ur"
                        >
                          {dish.urdu || "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {dish.pricePerPlate
                            ? formatRupees(dish.pricePerPlate)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              dish.active
                                ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] text-emerald-300"
                                : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                            }
                          >
                            {dish.active ? "Live" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${dish.name}`}
                              onClick={() => startEditDish(dish)}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${dish.name}`}
                              disabled={deletingDish === dish.slug}
                              onClick={() => removeDish(dish)}
                            >
                              {deletingDish === dish.slug ? (
                                <Loader2
                                  className="size-3.5 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Trash2
                                  className="size-3.5 text-destructive"
                                  aria-hidden
                                />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
