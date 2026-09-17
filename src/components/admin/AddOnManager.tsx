import { ImageField } from "@/components/admin/ImageField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Draft = {
  id: string | null;
  name: string;
  urdu: string;
  price: string;
  category: string;
  image: string;
  /** Storage id of a just-uploaded photo awaiting the first save. */
  pendingStorageId: string | null;
  active: boolean;
  sortOrder: number;
};

const emptyDraft = (category: string, nextSort: number): Draft => ({
  id: null,
  name: "",
  urdu: "",
  price: "",
  category,
  image: "",
  pendingStorageId: null,
  active: true,
  sortOrder: nextSort,
});

/**
 * Full CRUD for the Traditional Add-ons board.
 *
 * Deliberately small: pick a category, type the English and Urdu names, set a
 * price, optionally attach a photo. The item id and its position within the
 * category are derived on save, so there is nothing else to fill in.
 *
 * Categories are data, not code — the admin can invent new ones ("Tandoor
 * Breads", "Ice Cream") from the builder below, and they appear on the public
 * board in the order shown here.
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
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    urdu: "",
    icon: "🍽",
  });

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

  const countIn = (category: string) =>
    addons.filter((addon) => addon.category === category).length;

  const startCreate = (category?: string) => {
    const target = category ?? groups[0]?.id ?? "bread";
    const nextSort =
      addons
        .filter((addon) => addon.category === target)
        .reduce((max, addon) => Math.max(max, addon.sortOrder), 0) + 1;
    setEditing(emptyDraft(target, nextSort));
  };

  const startEdit = (addon: AddOnRow) => {
    setEditing({
      id: addon.id,
      name: addon.name,
      urdu: addon.urdu ?? "",
      price: String(addon.price),
      category: addon.category,
      image: addon.image ?? "",
      pendingStorageId: null,
      active: addon.active,
      sortOrder: addon.sortOrder,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (editing.name.trim().length < 2) {
      toast.error("Give the item a name first.");
      return;
    }
    if (!editing.price.trim() || Number(editing.price) < 0) {
      toast.error("Enter a price in rupees.");
      return;
    }
    setIsSaving(true);
    try {
      const result = await upsertAddOn({
        id: editing.id ?? undefined,
        name: editing.name,
        urdu: editing.urdu,
        price: Number(editing.price),
        category: editing.category,
        active: editing.active,
        sortOrder: editing.sortOrder,
      });
      // A photo chosen before the first save is attached now that the row exists.
      if (editing.pendingStorageId) {
        await setAddOnImage(result.id, editing.pendingStorageId);
      }
      toast.success(
        result.updated
          ? `${editing.name.trim()} updated — live on the site`
          : `${editing.name.trim()} added to the board`,
      );
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the item.",
      );
    } finally {
      setIsSaving(false);
    }
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

  const createCategory = async () => {
    if (newCategory.name.trim().length < 2) {
      toast.error("Give the category a name first.");
      return;
    }
    setSavingCategory(true);
    try {
      const created = await upsertAddOnCategory({
        name: newCategory.name,
        urdu: newCategory.urdu,
        icon: newCategory.icon,
        sortOrder: groups.length + 1,
        active: true,
      });
      toast.success(`${newCategory.name.trim()} added — add items to it now`);
      setNewCategory({ name: "", urdu: "", icon: "🍽" });
      setIsBuilding(false);
      // Drop straight into a new item for the category just created.
      setEditing(emptyDraft(created.id, 1));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the category.",
      );
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {addons.length} add-ons · {groups.length}{" "}
          {groups.length === 1 ? "category" : "categories"} · changes go live
          instantly
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsBuilding((open) => !open)}
            className="gap-2"
          >
            <Tags className="size-4" aria-hidden />
            New category
          </Button>
          <Button onClick={() => startCreate()} className="gap-2">
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>
        </div>
      </div>

      {/* Category builder */}
      {isBuilding ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              New add-on category
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close category builder"
              onClick={() => setIsBuilding(false)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Creates a new heading on the public add-ons board — like
            &ldquo;Tandoor Breads&rdquo; or &ldquo;Ice Cream&rdquo;.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-cat-name">Name (English)</Label>
              <Input
                id="addon-cat-name"
                value={newCategory.name}
                placeholder="e.g. Tandoor Breads"
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-cat-urdu">Name (Urdu)</Label>
              <Input
                id="addon-cat-urdu"
                value={newCategory.urdu}
                dir="rtl"
                lang="ur"
                placeholder="e.g. تندوری روٹی"
                onChange={(e) =>
                  setNewCategory({ ...newCategory, urdu: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-cat-icon">Icon</Label>
              <Input
                id="addon-cat-icon"
                value={newCategory.icon}
                maxLength={4}
                className="text-center text-lg"
                onChange={(e) =>
                  setNewCategory({ ...newCategory, icon: e.target.value })
                }
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setIsBuilding(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createCategory()}
              disabled={savingCategory}
              className="gap-2"
            >
              {savingCategory ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Create category
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {editing.id ? `Edit ${editing.name}` : "New add-on"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close editor"
              onClick={() => setEditing(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={editing.category}
                onValueChange={(value) =>
                  setEditing({ ...editing, category: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.icon} {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-name">Name (English)</Label>
              <Input
                id="addon-name"
                value={editing.name}
                placeholder="e.g. Cola"
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-urdu">Name (Urdu)</Label>
              <Input
                id="addon-urdu"
                value={editing.urdu}
                dir="rtl"
                lang="ur"
                placeholder="e.g. کولا"
                onChange={(e) =>
                  setEditing({ ...editing, urdu: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-price">Price (PKR)</Label>
              <Input
                id="addon-price"
                type="number"
                min={0}
                value={editing.price}
                placeholder="e.g. 100"
                onChange={(e) =>
                  setEditing({ ...editing, price: e.target.value })
                }
              />
            </div>

            <ImageField
              label="Item photo (optional)"
              value={editing.image}
              hint="JPG, PNG or WebP up to 5 MB — shown on the guest's add-on pill"
              onUploaded={(upload) => {
                // Editing an existing item attaches immediately; a new one
                // holds the storage id until the row exists to attach it to.
                if (editing.id) {
                  void setAddOnImage(editing.id, upload.storageId)
                    .then((url) => setEditing({ ...editing, image: url }))
                    .catch(() => toast.error("Could not attach the photo."));
                } else {
                  setEditing({
                    ...editing,
                    image: upload.previewUrl,
                    pendingStorageId: upload.storageId,
                  });
                }
              }}
              onCleared={() => {
                if (editing.id) {
                  void removeAddOnImage(editing.id).catch(() =>
                    toast.error("Could not remove the photo."),
                  );
                }
                setEditing({ ...editing, image: "", pendingStorageId: null });
              }}
            />

            <div className="flex flex-col justify-center">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">
                  Visible on the add-ons board
                  <span className="block text-xs text-muted-foreground">
                    Turn off to hide it without deleting
                  </span>
                </span>
                <Switch
                  checked={editing.active}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, active: checked })
                  }
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {editing.id ? "Save changes" : "Add to board"}
            </Button>
          </div>
        </div>
      ) : null}

      {groups.map((group) => {
        const items = addons.filter((addon) => addon.category === group.id);
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startCreate(group.id)}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Add to {group.name}
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                Nothing in this category yet.
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
                              onClick={() => startEdit(addon)}
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
    </div>
  );
}
