import {
  CategoryDialog,
  type CategoryFormValues,
  type CategoryIconName,
} from "@/components/admin/CategoryDialog";
import { ItemDialog, type ItemFormValues } from "@/components/admin/ItemDialog";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { Button } from "@/components/ui/button";
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
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** One menu category (counter) as the admin panel sees it. */
export type CounterOption = {
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIconName;
  sortOrder: number;
  active: boolean;
};

/**
 * Counters and the items inside them, on one screen.
 *
 * The shape is deliberately flat and obvious: **Create category** at the top
 * makes a section, and every section carries its own **Add item** button, so
 * building the menu is create → add → add. Both forms are dialogs, so the page
 * itself is only ever the list.
 *
 * Every save goes straight to Supabase over the shared realtime channel, so the
 * guest site shows it the moment it lands.
 */
export function CountersManager({
  categories,
  dishes,
}: {
  categories: CounterOption[];
  dishes: MenuDishRow[];
}) {
  // The dialogs stay mounted while they animate out, so the target of the
  // form is kept alongside its open flag rather than cleared on close.
  const [categoryForm, setCategoryForm] = useState<{
    open: boolean;
    /** `null` means the form is creating a new category. */
    editing: CounterOption | null;
  }>({ open: false, editing: null });
  const [itemForm, setItemForm] = useState<{
    open: boolean;
    /** `null` means the form is adding a new item. */
    dish: MenuDishRow | null;
    categoryId: string;
    /** Set for a category just created, before realtime has delivered it. */
    label: string;
  }>({ open: false, dish: null, categoryId: "", label: "" });
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [deletingDish, setDeletingDish] = useState<string | null>(null);

  const signatureCount = dishes.filter((dish) => dish.featured).length;

  /**
   * Categories in menu order, followed by any category an item still points at
   * so a stray row can never disappear from the panel.
   */
  const counters = useMemo<CounterOption[]>(() => {
    const list = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const known = new Set(list.map((counter) => counter.id));
    const orphans = [...new Set(dishes.map((dish) => dish.categoryId))]
      .filter((id) => id && !known.has(id))
      .map((id, index) => ({
        id,
        name: id === "uncategorized" ? "Uncategorized" : id,
        icon: "flame" as CategoryIconName,
        sortOrder: 900 + index,
        active: false,
      }));
    return [...list, ...orphans];
  }, [categories, dishes]);

  const itemsIn = (categoryId: string) =>
    dishes
      .filter((dish) => dish.categoryId === categoryId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const nextSortIn = (categoryId: string) =>
    itemsIn(categoryId).reduce((max, dish) => Math.max(max, dish.sortOrder ?? 0), 0) +
    1;

  /* -------------------------------------------------------- categories --- */

  const saveCategory = async (values: CategoryFormValues) => {
    const editing = categoryForm.editing;
    const result = await upsertCategory({
      id: editing?.id,
      name: values.name,
      urdu: values.urdu,
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
    // Straight into the first item for the category just created.
    if (result.created) {
      setItemForm({
        open: true,
        dish: null,
        categoryId: result.id,
        label: values.name,
      });
    }
  };

  const removeCategory = async (counter: CounterOption) => {
    if (
      !window.confirm(
        `Delete the ${counter.name} category? Its items move to uncategorized and disappear from the public menu until you reassign them.`,
      )
    ) {
      return;
    }
    setDeletingCategory(counter.id);
    try {
      await deleteCategory(counter.id);
      toast.success(`${counter.name} deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the category.",
      );
    } finally {
      setDeletingCategory(null);
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

  const openItem = (dish: MenuDishRow | null, categoryId: string) =>
    setItemForm({ open: true, dish, categoryId, label: "" });

  const itemCategoryName =
    itemForm.label ||
    counters.find((counter) => counter.id === itemForm.categoryId)?.name ||
    "";
  const editingDish = itemForm.dish;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ top bar --- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {counters.length} {counters.length === 1 ? "category" : "categories"} ·{" "}
          {dishes.length} items · changes go live instantly
        </p>
        <Button
          onClick={() => setCategoryForm({ open: true, editing: null })}
          className="gap-2"
        >
          <Plus className="size-4" aria-hidden />
          Create category
        </Button>
      </div>

      {/* ---------------------------------------------------- categories --- */}
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
                      ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] text-gold"
                      : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                  }
                >
                  {counter.active ? "Live" : "Hidden"}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openItem(null, counter.id)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add item
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${counter.name}`}
                  onClick={() =>
                    setCategoryForm({ open: true, editing: counter })
                  }
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${counter.name}`}
                  disabled={deletingCategory === counter.id}
                  onClick={() => removeCategory(counter)}
                >
                  {deletingCategory === counter.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                Nothing in this category yet — use{" "}
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

      <CategoryDialog
        open={categoryForm.open}
        onOpenChange={(open) =>
          setCategoryForm((form) => ({ ...form, open }))
        }
        kind="counter"
        initial={
          categoryForm.editing
            ? {
                name: categoryForm.editing.name,
                urdu: categoryForm.editing.urdu ?? "",
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
        categoryName={itemCategoryName}
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
