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

export type CartItem = {
  slug: string;
  name: string;
  unitPrice: number;
  count: number;
};

const STORAGE_KEY = "tribe-of-taste:cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  itemsTotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: { slug: string; name: string; unitPrice: number }) => void;
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

  const add = useCallback((item: { slug: string; name: string; unitPrice: number }) => {
    setItems((current) => {
      const existing = current.find((line) => line.slug === item.slug);
      if (existing) {
        return current.map((line) =>
          line.slug === item.slug
            ? { ...line, count: Math.min(line.count + 1, 20) }
            : line,
        );
      }
      return [...current, { ...item, count: 1 }];
    });
    // Quiet confirmation only — the guest keeps browsing. Navigation happens
    // exclusively when they click the cart or checkout buttons themselves.
    toast.success(`${item.name} added to your order`, {
      action: { label: "View cart", onClick: () => setIsOpen(true) },
    });
  }, []);

  const setCount = useCallback((slug: string, count: number) => {
    setItems((current) =>
      count <= 0
        ? current.filter((line) => line.slug !== slug)
        : current.map((line) =>
            line.slug === slug ? { ...line, count: Math.min(count, 20) } : line,
          ),
    );
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((current) => current.filter((line) => line.slug !== slug));
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
