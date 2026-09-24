import type { MenuCategory } from "@/lib/menu";
import {
  CakeSlice,
  CookingPot,
  CupSoda,
  Flame,
  Salad,
  Sandwich,
  Soup,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The badge a section carries on the guest menu and in the admin counter form.
 *
 * The admin form's icon picker is driven by the keys of this map, so an icon
 * added here is immediately offered when a counter is created or renamed — and
 * a counter seeded with an icon is always one this file can draw.
 */
export const CATEGORY_ICONS: Record<MenuCategory["icon"], LucideIcon> = {
  drink: CupSoda,
  soup: Soup,
  salad: Salad,
  bites: Sandwich,
  dessert: CakeSlice,
  flame: Flame,
  pot: CookingPot,
  bread: Wheat,
};
