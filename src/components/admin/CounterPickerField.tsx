import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Required "select counter" field for the item form.
 *
 * A dish is served from exactly one counter, and that is a real relationship:
 * `menu_dishes.category_id` is a foreign key to the counter row, so this field
 * writes that id and nothing else. It is a checkbox group rather than a
 * collapsed dropdown because the counter is the first decision a new item
 * needs, and a list makes the choice visible instead of hiding it behind a
 * control that has to be opened before it can be read.
 *
 * One box is ticked at a time, and the form refuses to save without one: an
 * item written with a blank `category_id` is invisible on the guest menu and
 * unattributable at the desk, which is the failure this field exists to stop.
 *
 * Hidden counters are offered too — switching a counter off takes it off the
 * guest site, but the owner still needs somewhere to keep its items.
 */
export function CounterPickerField({
  id,
  value,
  counters,
  onChange,
  invalid = false,
  className,
}: {
  id: string;
  value: string;
  counters: { id: string; name: string }[];
  onChange: (id: string) => void;
  /** Set after a save attempt with nothing ticked. */
  invalid?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-sm font-medium">
        Select counter
        <span className="ml-1 text-gold" aria-hidden>
          *
        </span>
      </legend>
      <div
        id={id}
        role="radiogroup"
        aria-label="Select counter"
        aria-invalid={invalid || undefined}
        className="flex flex-wrap gap-2"
      >
        {counters.map((counter) => {
          const active = counter.id === value;
          return (
            <button
              key={counter.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(counter.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-border/70 text-muted-foreground hover:border-gold/40 hover:text-foreground",
                invalid && !active && "border-destructive/50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  active
                    ? "border-gold bg-gold text-background"
                    : "border-border",
                )}
              >
                {active ? <Check className="size-3" /> : null}
              </span>
              {counter.name}
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "text-xs",
          invalid ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {invalid
          ? "Choose the counter this item is served from — the guest menu files it there."
          : "Required. The section this item appears under on the public menu."}
      </p>
    </fieldset>
  );
}
