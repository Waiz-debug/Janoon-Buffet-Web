import { CounterSelect } from "@/components/admin/CounterSelect";
import {
  CategoryDialog,
  type CategoryFormValues,
} from "@/components/admin/CategoryDialog";
import { ItemDialog, type ItemFormValues } from "@/components/admin/ItemDialog";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { Button } from "@/components/ui/button";
import {
  UNCATEGORIZED_COUNTER,
  deleteCategory,
  deleteDish,
  removeDishImage,
  setDishCategory,
  setDishImage,
  upsertCategory,
  upsertDish,
  type MenuCategoryRow,
  type MenuDishRow,
} from "@/lib/db";
import { counterChoices, groupByCounter } from "@/lib/counters";
import { SIGNATURE_LIMIT, formatRupees } from "@/lib/menu";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Counters and the items on each, on one screen.
 *
 * The shape is deliberately flat and obvious: **Create counter** at the top
 * makes a cooking station, and every station carries its own **Add item**
 * button, so building the menu is create → add → add. **Move to** on any row
 * re-files that item under another counter, which is the mapping an owner
 * actually reaches for — a dish that belongs at the charcoal grill rather than
 * the tandoor is one dropdown away, and only `category_id` is written.
 *
 * Counters are ordered with the arrows; the order saved here is the order the
 * guest site draws its sections in. Every save goes straight to Supabase over
 * the shared realtime channel, so the public menu shows it the moment it lands.
 */
export function CountersManager({
  categories,
  dishes,
}: {
  categories: MenuCategoryRow[];
  dishes: MenuDishRow[];
}) {
  // The dialogs stay mounted while they animate out, so the target of the
  // form is kept alongside its open flag rather than cleared on close.
  const [categoryForm, setCategoryForm] = useState<{
    open: boolean;
    /** `null` means the form is creating a new counter. */
    editing: MenuCategoryRow | null;
  }>({ open: false, editing: null });
  const [itemForm, setItemForm] = useState<{
    open: boolean;
    /** `null` means the form is adding a new item. */
    dish: MenuDishRow | null;
    categoryId: string;
    /** Set for a counter just created, before realtime has delivered it. */
    label: string;
  }>({ open: false, dish: null, categoryId: "", label: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const signatureCount = dishes.filter((dish) => dish.featured).length;

  /**
   * Counters in menu order, with their items already filed under them. Hidden
   * counters are listed too — the owner has to be able to switch one back on —
   * and `includeOrphans` gives anything pointing at a counter that no longer
   * exists a place at the bottom instead of losing it.
   */
  const counters = groupByCounter(categories, dishes, {
    includeHiddenCounters: true,
    includeHiddenItems: true,
    includeOrphans: true,
  });

  /**
   * Only the counters that really exist as rows; these can be reordered. Held
   * as plain strings because a counter the owner invents has an id the built-in
   * catalogue never listed.
   */
  const realIds = new Set<string>(categories.map((category) => category.id));
  const choices = counterChoices(categories);

  const nextSortIn = (categoryId: string) =>
    dishes
      .filter((dish) => dish.categoryId === categoryId)
      .reduce((max, dish) => Math.max(max, dish.sortOrder ?? 0), 0) + 1;

  /* -------------------------------------------------------- categories --- */

  const saveCategory = async (values: CategoryFormValues) => {
    const editing = categoryForm.editing;
    const result = await upsertCategory({
      id: editing?.id,
      name: values.name,
      urdu: values.urdu,
      // Sent on every save, so renaming a counter no longer blanks the line
      // printed under it on the public menu.
      blurb: values.blurb,
      icon: values.icon ?? editing?.icon ?? "flame",
      sortOrder:
        editing?.sortOrder ??
        counters.reduce((max, counter) => Math.max(max, counter.sortOrder), 0) + 1,
      active: values.active,
    });
    toast.success(
      result.created
        ? `${values.name} created — add its items now`
        : `${values.name} updated`,
    );
    // Straight into the first item for the counter just created.
    if (result.created) {
      setItemForm({
        open: true,
        dish: null,
        categoryId: result.id,
        label: values.name,
      });
    }
  };

  const removeCategory = async (counter: MenuCategoryRow) => {
    if (
      !window.confirm(
        `Delete the ${counter.name} counter? Its items move to Other and come off the public menu — move them to a counter and switch them back on to publish them again.`,
      )
    ) {
      return;
    }
    setBusy(counter.id);
    try {
      await deleteCategory(counter.id);
      toast.success(`${counter.name} deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the counter.",
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Move a counter one place up or down the menu.
   *
   * The whole list is re-numbered 1…n on every move rather than swapping two
   * numbers: counters seeded before this screen existed all carry `sort_order`
   * 0, and swapping zeroes with zeroes would look like nothing happened.
   */
  const moveCounter = async (id: string, direction: -1 | 1) => {
    const order = counters.filter((counter) => realIds.has(counter.id));
    const index = order.findIndex((counter) => counter.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= order.length) return;

    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];

    setBusy(id);
    try {
      await Promise.all(
        next.map((counter, position) =>
          upsertCategory({
            id: counter.id,
            name: counter.name,
            urdu: counter.urdu,
            blurb: counter.blurb,
            icon: counter.icon,
            sortOrder: position + 1,
            active: counter.active,
          }),
        ),
      );
      toast.success(`${order[index].name} moved ${direction < 0 ? "up" : "down"}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reorder the counters.",
      );
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------------------------------------- items --- */

  const saveItem = async (values: ItemFormValues) => {
    const { dish, categoryId } = itemForm;
    if (!categoryId) return;

    if (
      values.featured &&
      !dish?.featured &&
      signatureCount >= SIGNATURE_LIMIT
    ) {
      throw new Error(
        `Only ${SIGNATURE_LIMIT} signature dishes are allowed — turn one off first.`,
      );
    }

    const result = await upsertDish({
      slug: dish?.slug,
      name: values.name,
      urdu: values.urdu || undefined,
      categoryId,
      summary: values.summary.trim() || undefined,
      description: values.description.trim() || undefined,
      // A photo uploaded before the first save arrives as a storage path.
      image: values.pendingStorageId ? undefined : values.image.trim() || undefined,
      imagePath: values.pendingStorageId ?? undefined,
      pricePerPlate: values.price
        ? Math.max(0, Math.round(Number(values.price)))
        : undefined,
      active: values.active,
      featured: values.featured,
      sortOrder: dish?.sortOrder ?? nextSortIn(categoryId),
    });

    toast.success(
      result.updated
        ? `${values.name} updated — live on the site`
        : `${values.name} added to the menu`,
    );
  };

  const moveItem = async (dish: MenuDishRow, toCounterId: string) => {
    if (!toCounterId || toCounterId === dish.categoryId) return;
    setMoving(dish.slug);
    try {
      await setDishCategory(dish.slug, toCounterId);
      const name =
        choices.find((counter) => counter.id === toCounterId)?.name ?? toCounterId;
      toast.success(`${dish.name} moved to ${name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move the item.",
      );
    } finally {
      setMoving(null);
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
    setBusy(dish.slug);
    try {
      await deleteDish(dish.slug);
      toast.success(`${dish.name} removed from the menu`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the item.",
      );
    } finally {
      setBusy(null);
    }
  };

  const openItem = (dish: MenuDishRow | null, categoryId: string) =>
    setItemForm({ open: true, dish, categoryId, label: "" });

  const itemCounterName =
    itemForm.label ||
    counters.find((counter) => counter.id === itemForm.categoryId)?.name ||
    "";
  const editingDish = itemForm.dish;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ top bar --- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {counters.length} {counters.length === 1 ? "counter" : "counters"} ·{" "}
          {dishes.length} items · changes go live instantly
        </p>
        <Button
          onClick={() => setCategoryForm({ open: true, editing: null })}
          className="gap-2"
        >
          <Plus className="size-4" aria-hidden />
          Create counter
        </Button>
      </div>

      {/* ---------------------------------------------------- counters --- */}
      {counters.map((counter) => {
        const Icon = CATEGORY_ICONS[counter.icon] ?? CATEGORY_ICONS.flame;
        const isReal = realIds.has(counter.id);
        const isHome = counter.id === UNCATEGORIZED_COUNTER;
        const order = counters.filter((item) => realIds.has(item.id));
        const orderIndex = order.findIndex((item) => item.id === counter.id);
        const working = busy === counter.id;
        // Asked of the items themselves rather than derived from the count
        // beside it, so the panel cannot disagree with the guest site about
        // how many dishes on this counter are actually published.
        const live = counter.items.filter((item) => item.active !== false).length;

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
                  {live} live
                  {counter.hidden > 0 ? ` · ${counter.hidden} hidden` : ""}
                </span>
                <span
                  className={
                    counter.active
                      ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] text-gold"
                      : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                  }
                >
                  {counter.active ? "Live" : "Hidden"}
                </span>
                {isHome ? (
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    Holds items from deleted counters
                  </span>
                ) : null}
              </p>
              <div className="flex items-center gap-1">
                {isReal && !isHome ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${counter.name} up`}
                      disabled={working || orderIndex <= 0}
                      onClick={() => void moveCounter(counter.id, -1)}
                    >
                      <ChevronUp className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${counter.name} down`}
                      disabled={working || orderIndex === order.length - 1}
                      onClick={() => void moveCounter(counter.id, 1)}
                    >
                      <ChevronDown className="size-3.5" aria-hidden />
                    </Button>
                  </>
                ) : null}
                {/* No "Add item" on a counter that no longer exists: the item
                    would point at a row that is not there. Move the items
                    below onto a real counter instead. */}
                {isReal ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openItem(null, counter.id)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add item
                  </Button>
                ) : null}
                {isReal ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${counter.name}`}
                      onClick={() =>
                        setCategoryForm({
                          open: true,
                          editing:
                            categories.find((category) => category.id === counter.id) ??
                            null,
                        })
                      }
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    {isHome ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${counter.name}`}
                        disabled={working}
                        onClick={() => {
                          const row = categories.find(
                            (category) => category.id === counter.id,
                          );
                          if (row) void removeCategory(row);
                        }}
                      >
                        {working ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-3.5 text-destructive" aria-hidden />
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="px-2 text-[0.65rem] text-muted-foreground">
                    counter removed
                  </span>
                )}
              </div>
            </div>

            {counter.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                Nothing on this counter yet — use{" "}
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
                      <th className="px-4 py-3 font-medium">Move to</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        Price
                      </th>
                      <th className="px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {counter.items.map((dish) => (
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
                        <td className="px-4 py-3">
                          <CounterSelect
                            value={dish.categoryId}
                            counters={choices}
                            disabled={moving === dish.slug}
                            className="w-full min-w-[8.5rem]"
                            onChange={(id) => void moveItem(dish, id)}
                          />
                        </td>
                        <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                          {dish.pricePerPlate
                            ? formatRupees(dish.pricePerPlate)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              dish.active
                                ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] text-gold"
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
                              onClick={() => openItem(dish, dish.categoryId)}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${dish.name}`}
                              disabled={busy === dish.slug}
                              onClick={() => void removeDish(dish)}
                            >
                              {busy === dish.slug ? (
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

      <CategoryDialog
        open={categoryForm.open}
        onOpenChange={(open) => setCategoryForm((form) => ({ ...form, open }))}
        kind="counter"
        initial={
          categoryForm.editing
            ? {
                name: categoryForm.editing.name,
                urdu: categoryForm.editing.urdu ?? "",
                blurb: categoryForm.editing.blurb ?? "",
                icon: categoryForm.editing.icon,
                active: categoryForm.editing.active,
              }
            : undefined
        }
        onSubmit={saveCategory}
      />

      <ItemDialog
        open={itemForm.open}
        onOpenChange={(open) => setItemForm((form) => ({ ...form, open }))}
        mode="dish"
        categoryName={itemCounterName}
        counters={choices}
        counterId={itemForm.categoryId}
        onCounterChange={(id) => setItemForm((form) => ({ ...form, categoryId: id }))}
        itemId={editingDish?.slug ?? null}
        signatureCount={signatureCount}
        initial={
          editingDish
            ? {
                name: editingDish.name,
                urdu: editingDish.urdu ?? "",
                price: editingDish.pricePerPlate
                  ? String(editingDish.pricePerPlate)
                  : "",
                image: editingDish.image ?? "",
                active: editingDish.active ?? true,
                featured: editingDish.featured ?? false,
                summary: editingDish.summary ?? "",
                description: editingDish.description ?? "",
              }
            : undefined
        }
        onUpload={
          editingDish
            ? (storageId) => setDishImage(editingDish.slug, storageId)
            : undefined
        }
        onClear={editingDish ? () => removeDishImage(editingDish.slug) : undefined}
        onSubmit={saveItem}
      />
    </div>
  );
}
