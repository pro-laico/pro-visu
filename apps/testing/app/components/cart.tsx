"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface CartLine {
  slug: string;
  name: string;
  price: number;
  colorway: string;
  size?: string;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (line: Omit<CartLine, "qty">) => void;
  remove: (slug: string, size?: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function keyOf(slug: string, size?: string) {
  return `${slug}::${size ?? ""}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);

    function add(line: Omit<CartLine, "qty">) {
      setLines((prev) => {
        const k = keyOf(line.slug, line.size);
        const existing = prev.find((l) => keyOf(l.slug, l.size) === k);
        if (existing) return prev.map((l) => (keyOf(l.slug, l.size) === k ? { ...l, qty: l.qty + 1 } : l));
        return [...prev, { ...line, qty: 1 }];
      });
    }

    function remove(slug: string, size?: string) {
      const k = keyOf(slug, size);
      setLines((prev) => prev.filter((l) => keyOf(l.slug, l.size) !== k));
    }

    return { lines, count, subtotal, open, setOpen, add, remove };
  }, [lines, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
