import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Pick the counter a menu item belongs to — "move this dish to Charcoal
 * Counter". Used by the item form and by the item rows on the Menu board, so
 * both write the same `menu_dishes.category_id` the same way.
 *
 * Hidden counters are offered too: switching a counter off takes it off the
 * guest site, but the owner still needs somewhere to keep its items.
 */
export function CounterSelect({
  id,
  value,
  counters,
  onChange,
  disabled = false,
  placeholder = "Choose a counter",
  className,
}: {
  id?: string;
  value: string;
  counters: { id: string; name: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled || counters.length === 0}
    >
      <SelectTrigger
        id={id}
        aria-label="Counter"
        className={className ?? "w-full"}
        size="sm"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {counters.map((counter) => (
          <SelectItem key={counter.id} value={counter.id}>
            {counter.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
