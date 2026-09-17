import { ImageField } from "@/components/admin/ImageField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SIGNATURE_LIMIT } from "@/lib/menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";

export type ItemFormValues = {
  name: string;
  urdu: string;
  /** Rupees, as typed. */
  price: string;
  /** Current or just-uploaded photo URL. */
  image: string;
  /** Storage id of a photo uploaded before the row existed. */
  pendingStorageId: string | null;
  active: boolean;
  featured: boolean;
  summary: string;
  description: string;
};

const EMPTY: ItemFormValues = {
  name: "",
  urdu: "",
  price: "",
  image: "",
  pendingStorageId: null,
  active: true,
  featured: false,
  summary: "",
  description: "",
};

/**
 * The one "add an item" form, shared by the Counters board and the Add-ons
 * board.
 *
 * Four fields to fill in — English name, Urdu name, price, photo — with the
 * category supplied by the section you clicked "Add item" in. Menu items get
 * the visibility and Signature switches; their summary and description sit
 * behind a disclosure so the everyday form stays short.
 */
export function ItemDialog({
  open,
  onOpenChange,
  mode,
  categoryName,
  /** Set when editing, so a photo can attach to the row immediately. */
  itemId,
  initial,
  signatureCount = 0,
  onUpload,
  onClear,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "dish" | "addon";
  categoryName: string;
  itemId?: string | null;
  initial?: Partial<ItemFormValues>;
  /** How many signature dishes are already featured. */
  signatureCount?: number;
  /** Attach a just-uploaded photo to the existing row; resolves to its URL. */
  onUpload?: (storageId: string) => Promise<string>;
  onClear?: () => Promise<void>;
  /** Persist the item. Throwing keeps the dialog open and shows the error. */
  onSubmit: (values: ItemFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ItemFormValues>({ ...EMPTY, ...initial });
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  // A layout effect so the swap happens before the browser paints, with no
  // flash of the previous item's fields.
  useLayoutEffect(() => {
    if (!open) return;
    setValues({ ...EMPTY, ...initial });
    // Only surface the long fields when they already carry text.
    setShowMore(Boolean(initial?.summary || initial?.description));
    // `initial` is rebuilt by the caller on every render, so comparing it here
    // would loop; reopening the dialog is the only trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const editing = Boolean(itemId);
  const signatureFull =
    mode === "dish" && !values.featured && signatureCount >= SIGNATURE_LIMIT;
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (values.name.trim().length < 2) {
      toast.error("Give the item a name first.");
      return;
    }
    if (mode === "addon" && (values.price.trim() === "" || Number(values.price) < 0)) {
      toast.error("Enter a price in rupees.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim(), urdu: values.urdu.trim() });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the item.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${initial?.name}` : `Add to ${categoryName}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "dish"
              ? "Saved straight to the menu — the customer site updates the moment you press save."
              : "Saved straight to the add-ons board — it appears on the guest side instantly."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name">Name (English)</Label>
              <Input
                id="item-name"
                autoFocus
                value={values.name}
                placeholder={mode === "dish" ? "e.g. Mutton Chop" : "e.g. Cola"}
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-urdu">Name (Urdu)</Label>
              <Input
                id="item-urdu"
                dir="rtl"
                lang="ur"
                value={values.urdu}
                placeholder={mode === "dish" ? "e.g. مٹن چاپ" : "e.g. کولا"}
                onChange={(e) => set("urdu", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-price">
                {mode === "dish" ? "Price (Rs per plate)" : "Price (PKR)"}
              </Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                value={values.price}
                placeholder={mode === "dish" ? "e.g. 850" : "e.g. 100"}
                onChange={(e) => set("price", e.target.value)}
              />
              {mode === "dish" ? (
                <p className="text-xs text-muted-foreground">
                  Optional — used for delivery orders; the dine-in buffet
                  includes it either way.
                </p>
              ) : null}
            </div>
          </div>

          <ImageField
            label="Photo"
            value={values.image}
            hint="JPG, PNG or WebP up to 5 MB — shown on the guest's card"
            onUploaded={(upload) => {
              // Editing: attach now, the row exists. Creating: hold the
              // storage id until the row is written.
              if (itemId && onUpload) {
                void onUpload(upload.storageId)
                  .then((url) => set("image", url))
                  .catch(() => toast.error("Could not attach the photo."));
                return;
              }
              setValues((current) => ({
                ...current,
                image: upload.previewUrl,
                pendingStorageId: upload.storageId,
              }));
            }}
            onCleared={() => {
              if (itemId && onClear) {
                void onClear().catch(() =>
                  toast.error("Could not remove the photo."),
                );
              }
              setValues((current) => ({
                ...current,
                image: "",
                pendingStorageId: null,
              }));
            }}
          />

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
            <span className="text-sm">
              {mode === "dish" ? "Visible on the public menu" : "Visible on the add-ons board"}
              <span className="block text-xs text-muted-foreground">
                Turn off to hide it without deleting
              </span>
            </span>
            <Switch
              checked={values.active}
              onCheckedChange={(checked) => set("active", checked)}
            />
          </label>

          {mode === "dish" ? (
            <>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="text-sm">
                  Signature dish
                  <span className="block text-xs text-muted-foreground">
                    {signatureCount} of {SIGNATURE_LIMIT} used · Signature section
                    only
                  </span>
                </span>
                <Switch
                  checked={values.featured}
                  disabled={signatureFull}
                  onCheckedChange={(checked) => set("featured", checked)}
                />
              </label>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMore((open) => !open)}
                  className="justify-between gap-2 text-muted-foreground"
                >
                  Description
                  <ChevronDown
                    className={
                      showMore ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"
                    }
                    aria-hidden
                  />
                </Button>
                {showMore ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="item-summary">One-line summary</Label>
                      <Input
                        id="item-summary"
                        value={values.summary}
                        placeholder="Hand-pressed minced beef, grilled over open charcoal."
                        onChange={(e) => set("summary", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="item-description">Full description</Label>
                      <Textarea
                        id="item-description"
                        rows={3}
                        value={values.description}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {editing ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
