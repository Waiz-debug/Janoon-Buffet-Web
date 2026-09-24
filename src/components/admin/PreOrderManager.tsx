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
  createPreOrderItem,
  deletePreOrderItem,
  removePreOrderItemImage,
  setPreOrderItemImage,
  updatePreOrderItem,
  type PreOrderItemRow,
} from "@/lib/db";
import {
  PREORDER_CATEGORIES,
  formatRupees,
  preOrderCategoryLabel,
  type PreOrderCategoryId,
} from "@/lib/menu";
import { ChefHat, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Draft = {
  id: string | null;
  name: string;
  urdu: string;
  description: string;
  price: string;
  category: PreOrderCategoryId;
  serves: string;
  image: string;
  /** Storage id of a just-uploaded photo awaiting the first save. */
  pendingStorageId: string | null;
  active: boolean;
  sortOrder: number;
};

const emptyDraft = (nextSort: number): Draft => ({
  id: null,
  name: "",
  urdu: "",
  description: "",
  price: "",
  category: "slow-cooked",
  serves: "",
  image: "",
  pendingStorageId: null,
  active: true,
  sortOrder: nextSort,
});

/**
 * Full CRUD for the dishes guests can pre-order — Dumpukht, Sajji, party
 * platters and anything else the kitchen takes on order. There is no cap on
 * how many items the admin can add. Names are held in English and Urdu, prices
 * in rupees, and every item can carry its own photo uploaded to Supabase
 * Storage. Saving publishes the change to the public pre-order form instantly.
 */
export function PreOrderManager({
  items,
  loading,
}: {
  items: PreOrderItemRow[];
  loading: boolean;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startCreate = () => {
    const nextSort =
      items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
    setEditing(emptyDraft(nextSort));
  };

  const startEdit = (item: PreOrderItemRow) => {
    setEditing({
      id: item.id,
      name: item.name,
      urdu: item.urdu ?? "",
      description: item.description ?? "",
      price: String(item.price),
      category: item.category,
      serves: item.serves ?? "",
      image: item.image ?? "",
      pendingStorageId: null,
      active: item.active,
      sortOrder: item.sortOrder,
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
      const name = editing.name.trim();
      const price = Math.max(0, Math.round(Number(editing.price)));
      if (editing.id) {
        await updatePreOrderItem(editing.id, {
          name,
          urdu: editing.urdu.trim(),
          description: editing.description.trim(),
          price,
          category: editing.category,
          serves: editing.serves.trim(),
          active: editing.active,
          sortOrder: editing.sortOrder,
        });
        toast.success(`${name} updated — live on the pre-order form`);
      } else {
        const created = await createPreOrderItem({
          name,
          urdu: editing.urdu.trim() || undefined,
          description: editing.description.trim() || undefined,
          price,
          category: editing.category,
          serves: editing.serves.trim() || undefined,
          active: editing.active,
          demo: false,
          sortOrder: editing.sortOrder,
        });
        // A photo chosen before the first save attaches now that the row exists.
        if (editing.pendingStorageId) {
          await setPreOrderItemImage(created.id, editing.pendingStorageId);
        }
        toast.success(`${name} is now available for pre-order`);
      }
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the item.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (item: PreOrderItemRow) => {
    if (
      !window.confirm(
        `Remove ${item.name} from the pre-order list? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      await deletePreOrderItem(item.id);
      toast.success(`${item.name} removed`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the item.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} pre-order {items.length === 1 ? "item" : "items"} · add
          as many as the kitchen will take · changes go live instantly
        </p>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add pre-order item
        </Button>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {editing.id ? `Edit ${editing.name}` : "New pre-order item"}
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
              <Label htmlFor="preorder-name-en">Name (English)</Label>
              <Input
                id="preorder-name-en"
                value={editing.name}
                placeholder="e.g. Mutton Dumpukht"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="preorder-name-ur">Name (Urdu)</Label>
              <Input
                id="preorder-name-ur"
                value={editing.urdu}
                dir="rtl"
                lang="ur"
                placeholder="e.g. دم پخت"
                onChange={(e) => setEditing({ ...editing, urdu: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="preorder-description">Description</Label>
              <Textarea
                id="preorder-description"
                rows={3}
                value={editing.description}
                placeholder="How it is cooked, and how far ahead it must be ordered."
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                className="resize-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preorder-price">Price (PKR)</Label>
              <Input
                id="preorder-price"
                type="number"
                min={0}
                value={editing.price}
                placeholder="e.g. 3500"
                onChange={(e) =>
                  setEditing({ ...editing, price: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={editing.category}
                onValueChange={(value) =>
                  setEditing({
                    ...editing,
                    category: value as PreOrderCategoryId,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {PREORDER_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="preorder-serves">Serves</Label>
              <Input
                id="preorder-serves"
                value={editing.serves}
                placeholder="e.g. 2–4 guests"
                onChange={(e) =>
                  setEditing({ ...editing, serves: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preorder-sort">Sort order</Label>
              <Input
                id="preorder-sort"
                type="number"
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    sortOrder: Number(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">
                  Available for pre-order
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

            <div className="sm:col-span-2">
              <ImageField
                label="Dish photo (optional)"
                value={editing.image}
                hint="JPG, PNG or WebP up to 5 MB — shown on the public pre-order card"
                onUploaded={(upload) => {
                  // Editing an existing item attaches immediately; a new one
                  // holds the storage id until the row exists to attach it to.
                  if (editing.id) {
                    void setPreOrderItemImage(editing.id, upload.storageId)
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
                    void removePreOrderItemImage(editing.id).catch(() =>
                      toast.error("Could not remove the photo."),
                    );
                  }
                  setEditing({
                    ...editing,
                    image: "",
                    pendingStorageId: null,
                  });
                }}
              />
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
              {editing.id ? "Save changes" : "Add to pre-orders"}
            </Button>
          </div>
        </div>
      ) : null}

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
            {items.map((item) => (
              <tr key={item.id} className="bg-card/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60 text-gold">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ChefHat className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {preOrderCategoryLabel(item.category)}
                        {item.serves ? ` · serves ${item.serves}` : ""}
                      </span>
                    </span>
                  </div>
                </td>
                <td
                  className="hidden px-4 py-3 text-muted-foreground sm:table-cell"
                  dir="rtl"
                  lang="ur"
                >
                  {item.urdu || "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatRupees(item.price)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      item.active
                        ? "rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] text-gold"
                        : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                    }
                  >
                    {item.active ? "Live" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${item.name}`}
                      disabled={deletingId === item.id}
                      onClick={() => remove(item)}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-3.5 text-destructive" aria-hidden />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {loading
                    ? "Loading the pre-order list…"
                    : "No pre-order items yet — add the first one."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
