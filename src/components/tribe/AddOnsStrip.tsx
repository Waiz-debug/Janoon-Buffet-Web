import { useCart } from "@/hooks/use-cart";
import { useLiveSite, type LiveAddOn } from "@/hooks/use-live-site";
import {
  ADDON_GROUP_PHOTOS,
  DEFAULT_DISH_PHOTO,
  formatRupees,
} from "@/lib/menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

/**
 * The Traditional Add-ons board: naan and breads, sides and salads, drinks and
 * lassi, and cold drinks. Every heading comes from `addon_categories`, and
 * every item, price and photo from `menu_addons`, so whatever the admin saves
 * goes live immediately — including a category the owner invents. Each item is
 * a quick "add to order" pill — the guest keeps browsing after tapping.
 */
export function AddOnsStrip() {
  const { add } = useCart();
  const { addons, addonGroups } = useLiveSite();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleAdd = (addon: LiveAddOn) => {
    add({
      slug: addon.id,
      name: addon.name,
      unitPrice: addon.price,
    });
    setAddedIds((prev) => new Set(prev).add(addon.id));
    // Reset the checkmark after 2s so they can re-add
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(addon.id);
        return next;
      });
    }, 2000);
  };

  if (addons.length === 0) return null;

  return (
    <section id="addons" className="scroll-mt-24 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[0.7rem] tracking-[0.2em] text-gold/70 uppercase">
            Complete your order
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold">
            Traditional Add-ons
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Round out any delivery with fresh naan from the tandoor, house raita,
            green salad, a mint lassi, or something cold to drink — add them
            before checkout.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {addonGroups.map((group) => {
            const items = addons.filter((addon) => addon.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  <span aria-hidden>{group.icon}</span>
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((addon, index) => {
                    const justAdded = addedIds.has(addon.id);
                    // The item's own photo, or the photo of the group it sits
                    // in, or the house plate — so every pill carries a picture
                    // of food and none of them is an empty square.
                    const photo =
                      addon.image ||
                      ADDON_GROUP_PHOTOS[addon.group] ||
                      DEFAULT_DISH_PHOTO;
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
                          "inline-flex items-center gap-2 rounded-xl border py-2.5 pr-4 pl-2 text-sm transition-all",
                          justAdded
                            ? "border-gold/40 bg-gold/10 text-gold"
                            : "border-border/70 bg-card/40 text-foreground hover:border-gold/30 hover:bg-gold/[0.06]",
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/60">
                          <img
                            src={photo}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        </span>
                        <span className="font-medium">{addon.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRupees(addon.price)}
                        </span>
                        {justAdded ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : null}
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
