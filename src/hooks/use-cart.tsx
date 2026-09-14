import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export type CartAddOn = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  slug: string;
  name: string;
  unitPrice: number;
  count: number;
  /** Weight variant id, e.g. "half-kg" or "full-kg". Undefined = standard portion. */
  weight?: string;
  /** Selected add-ons for this line item. */
  addons?: CartAddOn[];
};

const STORAGE_KEY = "tribe-of-taste:cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  itemsTotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: {
    slug: string;
    name: string;
    unitPrice: number;
    weight?: string;
    addons?: CartAddOn[];
  }) => void;
  setCount: (slug: string, count: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[] | null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.slug === "string" &&
        typeof item.name === "string" &&
        typeof item.unitPrice === "number" &&
        typeof item.count === "number" &&
        item.count > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* private browsing — cart lives for the tab only */
    }
  }, [items, isLoaded]);

  const add = useCallback((item: {
    slug: string;
    name: string;
    unitPrice: number;
    weight?: string;
    addons?: CartAddOn[];
  }) => {
    // Build a unique key: slug + weight variant. Same dish with different
    // weight is a separate line in the cart.
    const key = item.weight ? `${item.slug}:${item.weight}` : item.slug;
    setItems((current) => {
      const existing = current.find((line) => {
        const lineKey = line.weight ? `${line.slug}:${line.weight}` : line.slug;
        return lineKey === key;
      });
      if (existing) {
        return current.map((line) => {
          const lineKey = line.weight ? `${line.slug}:${line.weight}` : line.slug;
          return lineKey === key
            ? { ...line, count: Math.min(line.count + 1, 20) }
            : line;
        });
      }
      return [...current, { ...item, count: 1 }];
    });
    const weightLabel = item.weight ? ` (${item.weight.replace(/-/g, " ")})` : "";
    toast.success(`${item.name}${weightLabel} added to your order`, {
      action: { label: "View cart", onClick: () => setIsOpen(true) },
    });
  }, []);

  const setCount = useCallback((slug: string, count: number) => {
    // slug here may be the composite "slug:weight" key
    setItems((current) =>
      count <= 0
        ? current.filter((line) => {
            const key = line.weight ? `${line.slug}:${line.weight}` : line.slug;
            return key !== slug;
          })
        : current.map((line) => {
            const key = line.weight ? `${line.slug}:${line.weight}` : line.slug;
            return key === slug ? { ...line, count: Math.min(count, 20) } : line;
          }),
    );
  }, []);

  const remove = useCallback((slug: string) => {
    // slug may be composite "slug:weight"
    setItems((current) =>
      current.filter((line) => {
        const key = line.weight ? `${line.slug}:${line.weight}` : line.slug;
        return key !== slug;
      }),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, line) => sum + line.count, 0);
    const itemsTotal = items.reduce(
      (sum, line) => sum + line.unitPrice * line.count,
      0,
    );
    return {
      items,
      itemCount,
      itemsTotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      add,
      setCount,
      remove,
      clear,
    };
  }, [items, isOpen, add, setCount, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
