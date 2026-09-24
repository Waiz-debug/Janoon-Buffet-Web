import { CounterSelect } from "@/components/admin/CounterSelect";
import { ItemDialog, type ItemFormValues } from "@/components/admin/ItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { counterChoices } from "@/lib/counters";
import {
  deleteDish,
  removeDishImage,
  setDishAvailability,
  setDishCategory,
  setDishImage,
  setDishPrice,
  upsertDish,
  type MenuCategoryRow,
  type MenuDishRow,
} from "@/lib/db";
import { SIGNATURE_LIMIT, formatRupees } from "@/lib/menu";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * The Menu board — one row per dish, whatever counter it sits on.
 *
 * Where the Counters board answers "what is on this station?", this answers
 * "what is on the menu?": every item in one list, with the three things an
 * owner changes in a hurry editable in place — its **counter**, its **price**
 * and whether it is **available**. Everything else (photo, description, Urdu
 * name) is one press away in the item form.
 *
 * The rows are the `menu_dishes` table and the columns beside them the
 * `menu_categories` rows they are filed under, both read through the shared
 * live cache — hidden rows and unpublished items included, nothing filtered out
 * of the list. So this board is the whole of what the guest site draws, and any
 * row on it can be edited, re-mapped, hidden or deleted here; a change made on
 * the Counters board, or by another device, appears without a reload.
 */
/**
 * The filter's "no filter" value. It cannot be an empty string: Radix refuses
 * a `SelectItem` with one.
 */
const EVERY_COUNTER = "all-counters";

export function MenuManager({
  categories,
  dishes,
  onLoadStarter,
  seeding = false,
}: {
  categories: MenuCategoryRow[];
  dishes: MenuDishRow[];
  /**
   * Writes the built-in catalogue into the two menu tables. Offered only while
   * the table holds no dishes at all, because that is the one state where the
   * guest menu has nothing to show and the starter catalogue is the answer.
   */
  onLoadStarter?: () => void;
  /** True while a seed is running, so the button cannot be pressed twice. */
  seeding?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [counterFilter, setCounterFilter] = useState(EVERY_COUNTER);
  const [itemForm, setItemForm] = useState<{
    open: boolean;
    dish: MenuDishRow | null;
    categoryId: string;
  }>({ open: false, dish: null, categoryId: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const choices = counterChoices(categories);
  const signatureCount = dishes.filter((dish) => dish.featured).length;

  const ordered = useMemo(() => {
    // Plain strings: a counter the owner invents is not one of the built-in
    // ids the catalogue type lists.
    const known = new Map<string, MenuCategoryRow>(
      categories.map((category) => [String(category.id), category]),
    );
    const rank = (id: string) => known.get(id)?.sortOrder ?? 900;
    return [...dishes].sort(
      (a, b) =>
        rank(a.categoryId) - rank(b.categoryId) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }, [categories, dishes]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ordered.filter((dish) => {
      if (counterFilter !== EVERY_COUNTER && dish.categoryId !== counterFilter) {
        return false;
      }
      if (!needle) return true;
      return [dish.name, dish.urdu ?? "", dish.summary ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [ordered, search, counterFilter]);

  const nextSortIn = (categoryId: string) =>
    dishes
      .filter((dish) => dish.categoryId === categoryId)
      .reduce((max, dish) => Math.max(max, dish.sortOrder ?? 0), 0) + 1;

  const counterName = (id: string) =>
    choices.find((counter) => counter.id === id)?.name ?? id;

  const changeCounter = async (dish: MenuDishRow, toCounterId: string) => {
    if (!toCounterId || toCounterId === dish.categoryId) return;
    setBusy(dish.slug);
    try {
      await setDishCategory(dish.slug, toCounterId);
      toast.success(`${dish.name} moved to ${counterName(toCounterId)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move the item.",
      );
    } finally {
      setBusy(null);
    }
  };

  const savePrice = async (dish: MenuDishRow, typed: string) => {
    const trimmed = typed.trim();
    const next = trimmed === "" ? null : Math.max(0, Math.round(Number(trimmed)));
    if (next !== null && !Number.isFinite(next)) {
      toast.error("Enter the price in rupees.");
      return;
    }
    if (next === (dish.pricePerPlate ?? null)) return;
    setBusy(dish.slug);
    try {
      await setDishPrice(dish.slug, next);
      toast.success(
        next === null
          ? `${dish.name} is back on the standard price`
          : `${dish.name} is now ${formatRupees(next)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the price.");
    } finally {
      setBusy(null);
    }
  };

  const toggleAvailability = async (dish: MenuDishRow, active: boolean) => {
    setBusy(dish.slug);
    try {
      await setDishAvailability(dish.slug, active);
      toast.success(
        active ? `${dish.name} is live on the menu` : `${dish.name} hidden from guests`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change availability.",
      );
    } finally {
      setBusy(null);
    }
  };

  const saveItem = async (values: ItemFormValues) => {
    const { dish, categoryId } = itemForm;
    if (!categoryId) return;

    if (values.featured && !dish?.featured && signatureCount >= SIGNATURE_LIMIT) {
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

  const editing = itemForm.dish;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ top bar --- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the menu — name, Urdu or description"
            aria-label="Search the menu"
            className="pl-9"
          />
        </div>
        <CounterSelect
          value={counterFilter}
          counters={[{ id: EVERY_COUNTER, name: "Every counter" }, ...choices]}
          onChange={setCounterFilter}
          className="w-[13rem]"
        />
        <Button
          className="gap-2"
          onClick={() =>
            setItemForm({
              open: true,
              dish: null,
              categoryId:
                counterFilter !== EVERY_COUNTER
                  ? counterFilter
                  : (choices[0]?.id ?? ""),
            })
          }
          disabled={choices.length === 0}
        >
          <Plus className="size-4" aria-hidden />
          Add item
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {visible.length} of {dishes.length} items
        {counterFilter !== EVERY_COUNTER ? ` on ${counterName(counterFilter)}` : ""} ·
        price, availability and counter save as you change them
      </p>

      {/* -------------------------------------------------------- table --- */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {dishes.length === 0
              ? "No dishes are in the database, so the guest menu has nothing to show. Load the starter catalogue, or use Add item to write your first one."
              : "Nothing matches that search."}
          </p>
          {dishes.length === 0 && onLoadStarter ? (
            <Button
              className="mt-4 gap-2"
              onClick={onLoadStarter}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Load the starter catalogue
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-left text-xs tracking-[0.14em] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Counter</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Available
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visible.map((dish) => (
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
                        <span className="block truncate text-xs text-muted-foreground">
                          {dish.featured ? "Signature · " : ""}
                          {dish.urdu || dish.summary || "—"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CounterSelect
                      value={dish.categoryId}
                      counters={choices}
                      disabled={busy === dish.slug}
                      className="w-full min-w-[8.5rem]"
                      onChange={(id) => void changeCounter(dish, id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PriceCell
                      dish={dish}
                      busy={busy === dish.slug}
                      onSave={(typed) => void savePrice(dish, typed)}
                    />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={dish.active ?? true}
                        disabled={busy === dish.slug}
                        aria-label={`${dish.name} availability`}
                        onCheckedChange={(checked) =>
                          void toggleAvailability(dish, checked)
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {dish.active ? "Live" : "Hidden"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${dish.name}`}
                        onClick={() =>
                          setItemForm({
                            open: true,
                            dish,
                            categoryId: dish.categoryId,
                          })
                        }
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
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-3.5 text-destructive" aria-hidden />
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

      <ItemDialog
        open={itemForm.open}
        onOpenChange={(open) => setItemForm((form) => ({ ...form, open }))}
        mode="dish"
        categoryName={counterName(itemForm.categoryId)}
        counters={choices}
        counterId={itemForm.categoryId}
        onCounterChange={(id) => setItemForm((form) => ({ ...form, categoryId: id }))}
        itemId={editing?.slug ?? null}
        signatureCount={signatureCount}
        initial={
          editing
            ? {
                name: editing.name,
                urdu: editing.urdu ?? "",
                price: editing.pricePerPlate ? String(editing.pricePerPlate) : "",
                image: editing.image ?? "",
                active: editing.active ?? true,
                featured: editing.featured ?? false,
                summary: editing.summary ?? "",
                description: editing.description ?? "",
              }
            : undefined
        }
        onUpload={
          editing ? (storageId) => setDishImage(editing.slug, storageId) : undefined
        }
        onClear={editing ? () => removeDishImage(editing.slug) : undefined}
        onSubmit={saveItem}
      />
    </div>
  );
}

/**
 * The price in the row, editable where it sits.
 *
 * Typed text is held locally and only written when the field loses focus or the
 * owner presses Enter, so a four-digit price is one save rather than four. The
 * live value is restored on Escape.
 */
function PriceCell({
  dish,
  busy,
  onSave,
}: {
  dish: MenuDishRow;
  busy: boolean;
  onSave: (typed: string) => void;
}) {
  const saved = dish.pricePerPlate ? String(dish.pricePerPlate) : "";
  const [typed, setTyped] = useState(saved);

  return (
    <Input
      type="number"
      min={0}
      inputMode="numeric"
      value={typed}
      disabled={busy}
      aria-label={`${dish.name} price in rupees`}
      placeholder="—"
      className="h-8 w-[6.5rem] tabular-nums"
      onChange={(event) => setTyped(event.target.value)}
      onBlur={() => onSave(typed)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setTyped(saved);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
