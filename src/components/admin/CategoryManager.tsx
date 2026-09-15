import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { deleteCategory, upsertCategory } from "@/lib/db";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CategoryOption = {
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: "flame" | "pot" | "bites" | "dessert";
  sortOrder: number;
  active: boolean;
};

type Draft = {
  id: string;
  name: string;
  urdu: string;
  blurb: string;
  icon: "flame" | "pot" | "bites" | "dessert";
  sortOrder: number;
  active: boolean;
  isNew: boolean;
};

export function CategoryManager({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startCreate = () => {
    const nextSort =
      categories.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;
    setEditing({
      id: "",
      name: "",
      urdu: "",
      blurb: "",
      icon: "flame",
      sortOrder: nextSort,
      active: true,
      isNew: true,
    });
  };

  const startEdit = (category: CategoryOption) => {
    setEditing({
      id: category.id,
      name: category.name,
      urdu: category.urdu ?? "",
      blurb: category.blurb ?? "",
      icon: category.icon,
      sortOrder: category.sortOrder,
      active: category.active,
      isNew: false,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.id.trim() || editing.name.trim().length < 2) {
      toast.error("A counter needs a short id and a name.");
      return;
    }
    setIsSaving(true);
    try {
      await upsertCategory({
        id: editing.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: editing.name.trim(),
        urdu: editing.urdu.trim() || undefined,
        blurb: editing.blurb.trim() || undefined,
        icon: editing.icon,
        sortOrder: editing.sortOrder,
        active: editing.active,
      });
      toast.success(
        editing.isNew
          ? `${editing.name.trim()} counter added`
          : `${editing.name.trim()} updated`,
      );
      setEditing(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the counter.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (category: CategoryOption) => {
    if (
      !window.confirm(
        `Delete the ${category.name} counter? Its dishes move to uncategorized and disappear from the public menu until reassigned.`,
      )
    ) {
      return;
    }
    setDeletingId(category.id);
    try {
      await deleteCategory(category.id);
      toast.success(`${category.name} deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the counter.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {categories.length} counters on the public menu
        </p>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add counter
        </Button>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-gold/30 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">
              {editing.isNew ? "New counter" : `Edit ${editing.name}`}
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
              <Label htmlFor="cat-id">Short id (URL-safe)</Label>
              <Input
                id="cat-id"
                value={editing.id}
                disabled={!editing.isNew}
                placeholder="e.g. tandoor"
                onChange={(e) => setEditing({ ...editing, id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {editing.isNew
                  ? "Lowercase letters, numbers and dashes."
                  : "The id is permanent once created."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={editing.name}
                placeholder="e.g. Tandoor Breads"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-urdu">Urdu name</Label>
              <Input
                id="cat-urdu"
                value={editing.urdu}
                onChange={(e) => setEditing({ ...editing, urdu: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-sort">Sort order</Label>
              <Input
                id="cat-sort"
                type="number"
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="cat-blurb">Description</Label>
              <Textarea
                id="cat-blurb"
                rows={2}
                value={editing.blurb}
                onChange={(e) => setEditing({ ...editing, blurb: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex gap-2">
                {(Object.keys(CATEGORY_ICONS) as (keyof typeof CATEGORY_ICONS)[]).map(
                  (icon) => {
                    const Icon = CATEGORY_ICONS[icon];
                    const active = editing.icon === icon;
                    return (
                      <button
                        key={icon}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setEditing({ ...editing, icon })}
                        className={
                          active
                            ? "flex size-11 items-center justify-center rounded-xl border border-gold/50 bg-gold/15 text-gold"
                            : "flex size-11 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:border-gold/30"
                        }
                      >
                        <Icon className="size-5" aria-hidden />
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
              <span className="text-sm">Visible on the public menu</span>
              <Switch
                checked={editing.active}
                onCheckedChange={(checked) =>
                  setEditing({ ...editing, active: checked })
                }
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {editing.isNew ? "Add counter" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.icon];
          return (
            <div
              key={category.id}
              className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/40 p-4"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {category.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    #{category.sortOrder}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {category.blurb || category.id}
                </p>
              </div>
              <span
                className={
                  category.active
                    ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] text-emerald-300"
                    : "rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                }
              >
                {category.active ? "Live" : "Hidden"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${category.name}`}
                onClick={() => startEdit(category)}
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${category.name}`}
                disabled={deletingId === category.id}
                onClick={() => remove(category)}
              >
                {deletingId === category.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5 text-destructive" aria-hidden />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
