import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useToast } from "../hooks/use-toast";

const WishlistContext = createContext(null);

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};

const LS_KEY = "oceanBazarWishlist";

export const WishlistProvider = ({ children }) => {
  const { toast } = useToast();

  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items]);

  const wishlistIdsSet = useMemo(() => {
    const s = new Set();
    items.forEach((it) => {
      if (!it) return;
      if (it.id != null) s.add(String(it.id));
    });
    return s;
  }, [items]);

  const toggleWishlist = (product) => {
    const pid = product?.id ?? product?._id;
    if (!pid) return false;
    const key = String(pid);
    const isSaved = wishlistIdsSet.has(key);

    if (isSaved) {
      setItems((prev) => prev.filter((it) => String(it?.id) !== key));
      toast({ title: "Removed from wishlist" });
      return false;
    }

    const entry = {
      id: key,
      name: product?.name ?? "",
      image: product?.image ?? null,
      supplier: product?.supplier ?? "",
    };
    setItems((prev) => [...prev, entry]);
    toast({ title: "Saved to wishlist" });
    return true;
  };

  const isWishlisted = (product) => {
    const pid = product?.id ?? product?._id;
    if (!pid) return false;
    return wishlistIdsSet.has(String(pid));
  };

  const removeFromWishlist = (productOrId) => {
    const pid = typeof productOrId === "string" ? productOrId : productOrId?.id ?? productOrId?._id;
    if (!pid) return;
    const key = String(pid);
    setItems((prev) => prev.filter((it) => String(it?.id) !== key));
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems: items,
        wishlistIds: Array.from(wishlistIdsSet),
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist: () => setItems([]),
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

