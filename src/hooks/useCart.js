// src/hooks/useCart.js
import { useEffect, useState } from "react";

export default function useCart() {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);

  const add = (product, opts = {}) => {
    const { qty = 1, color = null, size = null } = opts;
    setCart(prev => {
      const i = prev.findIndex(it => it.id === product.id && it.color === color && it.size === size);
      if (i > -1) { const copy = [...prev]; copy[i].qty += qty; return copy; }
      const item = {
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        image: product.images?.[0] || "https://via.placeholder.com/300x300?text=Product",
        qty, color, size
      };
      return [...prev, item];
    });
  };

  const inc = (index) => setCart(c => c.map((it,i)=> i===index ? ({ ...it, qty: it.qty+1 }) : it));
  const dec = (index) => setCart(c => c.map((it,i)=> i===index ? ({ ...it, qty: Math.max(1, it.qty-1) }) : it));
  const remove = (index) => setCart(c => c.filter((_,i)=> i!==index));
  const clear = () => setCart([]);

  const count = cart.reduce((s, it) => s + (it.qty||0), 0);
  const subtotal = cart.reduce((s, it) => s + (Number(it.price||0) * (it.qty||0)), 0);

  return { cart, add, inc, dec, remove, clear, count, subtotal };
}
