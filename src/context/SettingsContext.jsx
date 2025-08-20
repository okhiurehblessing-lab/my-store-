// src/context/SettingsContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore";

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    storeName: "Essyessentials",
    logoUrl: "",
    tagline: "",
    announcement: "Welcome to Essyessentials",
    whatsapp: "",
    contactEmail: "",
    bank: { accountName: "", accountNumber: "", bankName: "" },
    shippingBlocks: [],
    allowPickup: true,
    allowAddressNotThere: true,
    theme: { button: "#6d28d9", bg: "#ffffff", text: "#0b1220" }
  });
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState("");

  useEffect(() => {
    const sRef = doc(db, "settings", "store");
    const unsubS = onSnapshot(sRef, (snap) => {
      if (snap.exists()) setSettings((p) => ({ ...p, ...snap.data() }));
    });

    const colQ = query(collection(db, "collections"), orderBy("name", "asc"));
    const unsubC = onSnapshot(colQ, (snap) => setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const prodQ = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubP = onSnapshot(prodQ, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubS(); unsubC(); unsubP(); };
  }, []);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchQ = !q || (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
      const inCol = !activeCollection || (p.collections || []).includes(activeCollection) || p.collection === activeCollection;
      return matchQ && inCol;
    });
  }, [products, search, activeCollection]);

  return (
    <Ctx.Provider value={{
      settings, collections, products, visibleProducts,
      search, setSearch, activeCollection, setActiveCollection
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
