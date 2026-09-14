import { useCart } from "@/hooks/use-cart";
import { ADDONS, formatRupees } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

const GROUP_LABELS: Record<string, string> = {
  bread: "Breads & Naan",
  side: "Sides & Salads",
  drink: "Drinks & Lassi",
};

const GROUP_ICONS: Record<string, string> = {
  bread: "🫓",
  side: "🥗",
  drink: "🥤",
};

/**
 * Horizontal strip of traditional add-ons (Afghani Naan, Raita, Salad, etc.)
 * displayed between the menu and the pre-order section. Each item is a quick
 * "add to order" pill — the guest keeps browsing after tapping.
 */
export function AddOnsStrip() {
  const { add } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleAdd = (addon: (typeof ADDONS)[number]) => {
    add({
      slug: addon.id,
      name: addon.name,
      unitPrice: addon.price,
    });
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(addon.id);
      return next;
    });
    // Reset the checkmark after 2s so they can re-add
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(addon.id);
        return next;
      });
    }, 2000);
  };

  const groups = ["bread", "side", "drink"] as const;

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[0.7rem] tracking-[0.2em] text-gold/70 uppercase">
            Complete your order
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold">
            Traditional Add-ons
          </h3>
          <p className="mt-2 max-w-lg mx-auto text-sm text-muted-foreground">
            Round out any delivery with fresh naan from the tandoor, house raita,
            green salad, or a cold lassi — add them before checkout.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {groups.map((group) => {
            const items = ADDONS.filter((a) => a.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  <span aria-hidden>{GROUP_ICONS[group]}</span>
                  {GROUP_LABELS[group]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((addon, index) => {
                    const justAdded = addedIds.has(addon.id);
                    return (
                      <motion.button
                        key={addon.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.3, delay: index * 0.04 }}
                        onClick={() => handleAdd(addon)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all",
                          justAdded
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-border/70 bg-card/40 text-foreground hover:border-gold/30 hover:bg-gold/[0.06]",
                        )}
                      >
                        {justAdded ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          <Plus className="size-3.5" aria-hidden />
                        )}
                        <span className="font-medium">{addon.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRupees(addon.price)}
                        </span>
                        <span className="hidden text-[0.65rem] text-gold/50 sm:inline">
                          {addon.urdu}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
