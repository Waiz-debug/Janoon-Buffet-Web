import type { MenuCategory } from "@/lib/menu";
import { CakeSlice, CookingPot, Flame, Sandwich, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<MenuCategory["icon"], LucideIcon> = {
  flame: Flame,
  pot: CookingPot,
  bread: Wheat,
  bites: Sandwich,
  dessert: CakeSlice,
};
