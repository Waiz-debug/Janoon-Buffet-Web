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
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

export type CategoryFormValues = {
  name: string;
  urdu: string;
  /** The line the public menu prints under the counter's name. */
  blurb?: string;
  /** Only the counter form carries an icon. */
  icon?: CategoryIconName;
  active: boolean;
};

/**
 * The one "create a counter" form, shared by the Counters board and the
 * Add-ons board so both read identically.
 *
 * Deliberately tiny: a name in English and Urdu is all that is required — the
 * id, position and default icon are derived on save. Counters add a one-row
 * icon picker, because the public menu draws that icon beside the section, and
 * a description, because that is the line printed under the counter's name.
 * Add-on headings carry an emoji the panel sets for them.
 */
type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "counter" | "addon";
  initial?: {
    name?: string;
    urdu?: string;
    blurb?: string;
    icon?: CategoryIconName;
    active?: boolean;
  };
  /** Persist the category. Throwing keeps the dialog open and shows the error. */
  onSubmit: (values: CategoryFormValues) => Promise<void>;
};

/**
 * The form is mounted only while the dialog is open, so it is built from
 * `initial` every single time it appears. Reopening for a different category can
 * therefore never show the last one's text, and no effect is needed to swap four
 * fields — which is why this used to flash the previous category before
 * repainting.
 */
export function CategoryDialog({ open, ...form }: CategoryDialogProps) {
  if (!open) return null;
  return <CategoryForm {...form} />;
}

function CategoryForm({
  onOpenChange,
  kind,
  initial,
  onSubmit,
}: Omit<CategoryDialogProps, "open">) {
  const [name, setName] = useState(initial?.name ?? "");
  const [urdu, setUrdu] = useState(initial?.urdu ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? "flame");
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(initial?.name);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error(kind === "counter" ? "Give the counter a name first." : "Give the category a name first.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        urdu: urdu.trim(),
        // Sent on every save. Leaving it out of the payload is what used to
        // blank a counter's description the moment someone renamed it.
        blurb: kind === "counter" ? blurb.trim() : undefined,
        icon: kind === "counter" ? icon : undefined,
        active,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the counter.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Edit ${initial?.name}`
              : kind === "counter"
                ? "Create a counter"
                : "Create an add-on category"}
          </DialogTitle>
          <DialogDescription>
            {kind === "counter"
              ? "A cooking station on the menu, like Barbecue & Grill or Charcoal Counter. Add its items once it exists."
              : "A new heading on the guest add-ons board, like Tandoor Breads or Ice Cream."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Name (English)</Label>
            <Input
              id="category-name"
              autoFocus
              value={name}
              placeholder={kind === "counter" ? "e.g. Tandoor" : "e.g. Cold Drinks"}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category-urdu">Name (Urdu)</Label>
            <Input
              id="category-urdu"
              dir="rtl"
              lang="ur"
              value={urdu}
              placeholder={kind === "counter" ? "e.g. تندور" : "e.g. کولڈ ڈرنک"}
              onChange={(e) => setUrdu(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          {kind === "counter" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="counter-blurb">Description</Label>
              <Textarea
                id="counter-blurb"
                rows={2}
                value={blurb}
                placeholder="Charcoal counters that stay lit all night, working from recipes the family has grilled for years."
                onChange={(e) => setBlurb(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Printed under the counter&apos;s name on the public menu.
              </p>
            </div>
          ) : null}

          {kind === "counter" ? (
            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex gap-2">
                {(Object.keys(CATEGORY_ICONS) as CategoryIconName[]).map((key) => {
                  const Icon = CATEGORY_ICONS[key];
                  const selected = icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      aria-label={key}
                      onClick={() => setIcon(key)}
                      className={
                        selected
                          ? "flex size-10 items-center justify-center rounded-xl border border-gold/50 bg-gold/15 text-gold"
                          : "flex size-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-gold/30"
                      }
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {editing ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
              <span className="text-sm">Visible on the public site</span>
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {editing ? "Save changes" : kind === "counter" ? "Create counter" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
