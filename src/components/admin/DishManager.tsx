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
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDish,
  removeDishImage,
  setDishImage,
  upsertDish,
  type MenuDishRow,
} from "@/lib/db";
import { formatRupees } from "@/lib/menu";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CategoryOption = { id: string; name: string };

type Draft = {
  slug: string | null;
  name: string;
  urdu: string;
  categoryId: string;
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

const emptyDraft = (categoryId: string, nextSort: number): Draft => ({
  slug: null,
  name: "",
  urdu: "",
  categoryId,
  summary: "",
  description: "",
  pricePerPlate: "",
  image: "",
  pendingStorageId: null,
  active: true,
  featured: false,
  sortOrder: nextSort,
});

export function DishManager({
  dishes,
  categories,
}: {
  dishes: MenuDishRow[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const startCreate = () => {
    const fallback = categories[0]?.id ?? "";
    const nextSort =
      dishes
        .filter((dish) => dish.categoryId === fallback)
        .reduce((max, dish) => Math.max(max, dish.sortOrder ?? 0), 0) + 1;
    setEditing(emptyDraft(fallback, nextSort));
  };

  const startEdit = (dish: MenuDishRow) => {
    setEditing({
      slug: dish.slug,
      name: dish.name,
      urdu: dish.urdu ?? "",
      categoryId: dish.categoryId,
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

  const save = async () => {
    if (!editing) return;
    if (editing.name.trim().length < 2) {
      toast.error("Give the dish a name first.");
      return;
    }
    setIsSaving(true);
    try {
      const result = await upsertDish({
        slug: editing.slug ?? undefined,
        name: editing.name.trim(),
        urdu: editing.urdu.trim() || undefined,
        categoryId: editing.categoryId,
        summary: editing.summary.trim() || undefined,
        description: editing.description.trim() || undefined,
        image: editing.pendingStorageId
          ? undefined
          : editing.image.trim() || undefined,
        imagePath: editing.pendingStorageId ?? undefined,
        active: editing.active,
        featured: editing.featured,
        sortOrder: editing.sortOrder,
        pricePerPlate: editing.pricePerPlate
          ? Math.max(0, Math.round(Number(editing.pricePerPlate)))
          : undefined,
      });
      toast.success(
        result.updated
          ? `${editing.name.trim()} updated — live on the site`
          : `${editing.name.trim()} added to the menu`,
      );
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the dish.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (dish: MenuDishRow) => {
    if (
      !window.confirm(
        `Remove ${dish.name} from the public menu? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingSlug(dish.slug);
    try {
      await deleteDish(dish.slug);
      toast.success(`${dish.name} removed from the menu`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the dish.",
      );
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dishes.length} dishes · changes go live instantly
        </p>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add dish
        </Button>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {editing.slug ? `Edit ${editing.name}` : "New dish"}
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
              <Label htmlFor="dish-name">Name</Label>
              <Input
                id="dish-name"
                value={editing.name}
                placeholder="e.g. Mutton Chop"
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-urdu">Urdu name (optional)</Label>
              <Input
                id="dish-urdu"
                value={editing.urdu}
                onChange={(e) =>
                  setEditing({ ...editing, urdu: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Counter</Label>
              <Select
                value={editing.categoryId}
                onValueChange={(value) =>
                  setEditing({ ...editing, categoryId: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose counter" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-price">Delivery price (Rs per plate)</Label>
              <Input
                id="dish-price"
                type="number"
                min={0}
                value={editing.pricePerPlate}
                placeholder="e.g. 850"
                onChange={(e) =>
                  setEditing({ ...editing, pricePerPlate: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Shown as the per-plate delivery price; included in the dine-in
                buffet either way.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dish-summary">One-line summary</Label>
              <Input
                id="dish-summary"
                value={editing.summary}
                placeholder="Hand-pressed minced beef, grilled over open charcoal."
                onChange={(e) =>
                  setEditing({ ...editing, summary: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dish-description">Full description</Label>
              <Textarea
                id="dish-description"
                rows={3}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </div>

            <ImageField
              label="Dish photo"
              value={editing.image}
              hint="JPG, PNG or WebP up to 5 MB"
              onUploaded={(upload) => {
                // Editing an existing dish: attach immediately (returns the
                // storage URL). Creating: hold a preview until the dish is
                // saved, then the URL is persisted with the form.
                if (editing.slug) {
                  void setDishImage(editing.slug, upload.storageId)
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
                if (editing.slug) {
                  void removeDishImage(editing.slug).catch(() =>
                    toast.error("Could not remove the photo."),
                  );
                }
                setEditing({ ...editing, image: "", pendingStorageId: null });
              }}
            />

            <div className="flex flex-col justify-center gap-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">Visible on the public menu</span>
                <Switch
                  checked={editing.active}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, active: checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">
                  Signature
                  <span className="block text-xs text-muted-foreground">
                    Featured in the highlights strip
                  </span>
                </span>
                <Switch
                  checked={editing.featured}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, featured: checked })
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
              {editing.slug ? "Save changes" : "Add to menu"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-left text-xs tracking-[0.14em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Dish</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Counter
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Price
              </th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {dishes.map((dish) => (
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
                        "🍽"
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {dish.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground sm:hidden">
                        {formatRupees(dish.pricePerPlate ?? 0)}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {categories.find((c) => c.id === dish.categoryId)?.name ??
                    dish.categoryId}
                </td>
                <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                  {dish.pricePerPlate ? formatRupees(dish.pricePerPlate) : "—"}
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
                      onClick={() => startEdit(dish)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${dish.name}`}
                      disabled={deletingSlug === dish.slug}
                      onClick={() => remove(dish)}
                    >
                      {deletingSlug === dish.slug ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-3.5 text-destructive" aria-hidden />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {dishes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No dishes yet — add the first one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

    </div>
  );
}
