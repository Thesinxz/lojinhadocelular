import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";

export interface CartItem {
  id: string; // chave única: `${productId}-${variantId || color}-${storage}`
  productId: number | string;
  variantId?: number | string;
  name: string;
  color: string;
  storage: string;
  condition: string; // "Seminovo" | "Lacrado"
  sku: string; // Ex: "B2700"
  price: number; // em centavos (ex: 339000 para R$ 3.390,00)
  imageUrl: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  totalPix: number;
  totalItems: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  buildWhatsAppMessage: (options?: {
    fees?: FeeTable;
    installmentsMax?: number;
    unitName?: string;
    storeName?: string;
  }) => string;
}

const STORAGE_KEY = "lojinha_cart_items_v1";

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignora erro no localStorage
    }
    return [];
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignora erro de cota no localStorage
    }
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (newItem: Omit<CartItem, "quantity">, qty = 1) => {
      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.id === newItem.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qty,
          };
          return updated;
        }
        return [...prev, { ...newItem, quantity: Math.max(1, qty) }];
      });
      setIsOpen(true);
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalPix = useMemo(() => {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [items]);

  const totalItems = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }, [items]);

  const buildWhatsAppMessage = useCallback(
    (options?: {
      fees?: FeeTable;
      installmentsMax?: number;
      unitName?: string;
      storeName?: string;
    }) => {
      const storeName = options?.storeName || "Lojinha do Celular";
      const unitName = options?.unitName || "Unidade Jardim - MS";
      const maxInstallments = options?.installmentsMax || 12;
      const fees = options?.fees || {};

      const fee12 = fees[String(maxInstallments)] ?? fees["12"] ?? 0;
      const installment12 =
        totalPix > 0
          ? installmentFromFees(totalPix, maxInstallments, fee12)
          : 0;

      const lines: string[] = [];
      lines.push(`*Olá, ${storeName}!* 📱`);
      lines.push(`Quero fechar este pedido pelo site:\n`);

      items.forEach((item, index) => {
        const num = index + 1;
        const colorPart = item.color ? ` - ${item.color}` : "";
        const storagePart = item.storage && item.storage !== "Padrão" ? ` ${item.storage}` : "";
        const condPart = item.condition ? ` (${item.condition})` : "";
        const skuPart = item.sku ? ` — cód. ${item.sku}` : "";
        const qtyPart = item.quantity > 1 ? ` [x${item.quantity}]` : "";

        lines.push(`${num}. *${item.name}${colorPart}${storagePart}*${condPart}${skuPart}${qtyPart}`);
        lines.push(`Pix: ${formatBRL(item.price * item.quantity)}`);
        lines.push(``);
      });

      lines.push(`*Total no Pix: ${formatBRL(totalPix)}*`);
      if (installment12 > 0) {
        lines.push(`ou em até ${maxInstallments}x de ${formatBRL(installment12)} no cartão`);
      }
      lines.push(``);
      lines.push(`📍 Unidade: ${unitName}`);
      lines.push(`Pode confirmar disponibilidade e a entrega? 📦`);

      return lines.join("\n");
    },
    [items, totalPix],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        totalPix,
        totalItems,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        buildWhatsAppMessage,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart deve ser usado dentro de um CartProvider");
  }
  return context;
}
