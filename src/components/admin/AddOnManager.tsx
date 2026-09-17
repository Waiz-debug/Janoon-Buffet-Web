import {
  CategoryDialog,
  type CategoryFormValues,
} from "@/components/admin/CategoryDialog";
import { ItemDialog, type ItemFormValues } from "@/components/admin/ItemDialog";
import { Button } from "@/components/ui/button";
import {
  deleteAddOn,
  removeAddOnImage,
  setAddOnImage,
  upsertAddOn,
  upsertAddOnCategory,
  type AddOnCategoryRow,
  type AddOnRow,
} from "@/lib/db";
import { ADDON_GROUPS, formatRupees } from "@/lib/menu";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * The Traditional Add-ons board, in the same shape as the Counters board:
 * **Create category** at the top, and an **Add item** button inside every
 * category.
 *
 * Categories are data, not code — the owner invents them ("Tandoor Breads",
 * "Ice Cream") and they appear on the guest board immediately. An item needs a
 * name in English and Urdu, a price and optionally a photo; everything else is
 * derived on save.
 */
export function AddOnManager({
  addons,
  categories,
  categoriesLoaded,
}: {
  addons: AddOnRow[];
  categories: AddOnCategoryRow[];
  categoriesLoaded: boolean;
}) {
  const [categoryForm, setCategoryForm] = useState<{
    open: boolean;
    editing: AddOnCategoryRow | null;
  }>({ open: false, editing: null });
  const [itemForm, setItemForm] = useState<{
    open: boolean;
    addon: AddOnRow | null;
    categoryId: string;
    /** Set for a category just created, before realtime has delivered it. */
    label: string;
  }>({ open: false, addon: null, categoryId: "", label: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * The headings to render, in order: the admin's categories when they exist,
   * the built-in four before the table has been seeded, plus any category an
   * existing add-on still points at so no item can go missing from this list.
   */
  const groups = useMemo<AddOnCategoryRow[]>(() => {
    const list: AddOnCategoryRow[] =
      categories.length > 0
        ? categories.map((category) => ({ ...category }))
        : ADDON_GROUPS.map((group, index) => ({
            id: group.id,
            name: group.label,
            urdu: group.urdu,
            icon: group.icon,
            sortOrder: index + 1,
            active: true,
          }));

    const known = new Set(list.map((category) => category.id));
    const orphans = [...new Set(addons.map((addon) => addon.category))]
      .filter((id) => id && !known.has(id))
      .map((id, index) => ({
        id,
        name: id,
        urdu: undefined,
        icon: "🍽",
        sortOrder: 900 + index,
        active: true,
      }));

    return [...list, ...orphans].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [addons, categories]);

  const itemsIn = (categoryId: string) =>
    addons
      .filter((addon) => addon.category === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const nextSortIn = (categoryId: string) =>
    itemsIn(categoryId).reduce((max, addon) => Math.max(max, addon.sortOrder), 0) + 1;

  /* -------------------------------------------------------- categories --- */

  const saveCategory = async (values: CategoryFormValues) => {
    const editing = categoryForm.editing;
    const result = await upsertAddOnCategory({
      id: editing?.id,
      name: values.name,
      urdu: values.urdu,
      // The emoji is the add-on headings' own decoration; a new one gets the
      // board's default cutlery mark.
      icon: editing?.icon,
      sortOrder:
        editing?.sortOrder ??
        groups.reduce((max, group) => Math.max(max, group.sortOrder), 0) + 1,
      active: values.active,
    });
    toast.success(
      result.created
        ? `${values.name} created — add its items now`
        : `${values.name} renamed`,
    );
    if (result.created) {
      setItemForm({
        open: true,
        addon: null,
        categoryId: result.id,
        label: values.name,
      });
    }
  };

  /* ------------------------------------------------------------- items --- */

  const saveItem = async (values: ItemFormValues) => {
    const { addon, categoryId } = itemForm;
    if (!categoryId) return;
    if (values.price.trim() === "" || Number(values.price) < 0) {
      throw new Error("Enter a price in rupees.");
    }

    const result = await upsertAddOn({
      id: addon?.id,
      name: values.name,
      urdu: values.urdu,
      price: Math.max(0, Math.round(Number(values.price))),
      category: categoryId,
      active: values.active,
      sortOrder: addon?.sortOrder ?? nextSortIn(categoryId),
    });

    // A photo chosen before the first save attaches now that the row exists.
    if (values.pendingStorageId) {
      await setAddOnImage(result.id, values.pendingStorageId);
    }

    toast.success(
      result.updated
        ? `${values.name} updated — live on the site`
        : `${values.name} added to the board`,
    );
  };

  const remove = async (addon: AddOnRow) => {
    if (
      !window.confirm(
        `Remove ${addon.name} from the add-ons board? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(addon.id);
    try {
      await deleteAddOn(addon.id);
      toast.success(`${addon.name} removed`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the item.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const editingAddOn = itemForm.addon;
  const itemCategoryName =
    itemForm.label || groups.find((group) => group.id === itemForm.categoryId)?.name || "";

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ top bar --- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {addons.length} add-ons · {groups.length}{" "}
          {groups.length === 1 ? "category" : "categories"} · changes go live
          instantly
        </p>
        <Button
          onClick={() => setCategoryForm({ open: true, editing: null })}
          className="gap-2"
        >
          <Plus className="size-4" aria-hidden />
          Create category
        </Button>
      </div>

      {/* ------------------------------------------------ categories + items */}
      {groups.map((group) => {
        const items = itemsIn(group.id);
        return (
          <div key={group.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2 text-xs tracking-[0.14em] text-muted-foreground uppercase">
                <span aria-hidden>{group.icon}</span>
                {group.name}
                {group.urdu ? (
                  <span className="tracking-normal text-gold/60 normal-case">
                    {group.urdu}
                  </span>
                ) : null}
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] normal-case">
                  {items.length}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setItemForm({
                      open: true,
                      addon: null,
                      categoryId: group.id,
                      label: "",
                    })
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add item
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Rename ${group.name}`}
                  onClick={() => setCategoryForm({ open: true, editing: group })}
                >
                  <Pencil className="size-3.5" aria-hidden />
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
                    {items.map((addon) => (
                      <tr key={addon.id} className="bg-card/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60 text-base">
                              {addon.image ? (
                                <img
                                  src={addon.image}
                                  alt=""
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span aria-hidden>{group.icon}</span>
                              )}
                            </span>
                            <span className="min-w-0 truncate font-medium">
                              {addon.name}
                            </span>
                          </div>
                        </td>
                        <td
                          className="hidden px-4 py-3 text-muted-foreground sm:table-cell"
                          dir="rtl"
                          lang="ur"
                        >
                          {addon.urdu || "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatRupees(addon.price)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              addon.active
                                ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] text-emerald-300"
                                : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                            }
                          >
                            {addon.active ? "Live" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${addon.name}`}
                              onClick={() =>
                                setItemForm({
                                  open: true,
                                  addon,
                                  categoryId: addon.category,
                                  label: "",
                                })
                              }
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${addon.name}`}
                              disabled={deletingId === addon.id}
                              onClick={() => remove(addon)}
                            >
                              {deletingId === addon.id ? (
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

      {!categoriesLoaded && addons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          Loading the add-ons board…
        </p>
      ) : null}

      <CategoryDialog
        open={categoryForm.open}
        onOpenChange={(open) => setCategoryForm((form) => ({ ...form, open }))}
        kind="addon"
        initial={
          categoryForm.editing
            ? {
                name: categoryForm.editing.name,
                urdu: categoryForm.editing.urdu ?? "",
                active: categoryForm.editing.active,
              }
            : undefined
        }
        onSubmit={saveCategory}
      />

      <ItemDialog
        open={itemForm.open}
        onOpenChange={(open) => setItemForm((form) => ({ ...form, open }))}
        mode="addon"
        categoryName={itemCategoryName}
        itemId={editingAddOn?.id ?? null}
        initial={
          editingAddOn
            ? {
                name: editingAddOn.name,
                urdu: editingAddOn.urdu ?? "",
                price: String(editingAddOn.price),
                image: editingAddOn.image ?? "",
                active: editingAddOn.active,
              }
            : undefined
        }
        onUpload={
          editingAddOn
            ? (storageId) => setAddOnImage(editingAddOn.id, storageId)
            : undefined
        }
        onClear={
          editingAddOn
            ? () => removeAddOnImage(editingAddOn.id)
            : undefined
        }
        onSubmit={saveItem}
      />
    </div>
  );
}
