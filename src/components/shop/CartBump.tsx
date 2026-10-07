"use client";

import { useEffect } from "react";

/** Gives the header cart a little bounce whenever something is added. Renders nothing. */
export default function CartBump() {
  useEffect(() => {
    const on = () => {
      const el = document.getElementById("cart-link");
      if (!el) return;
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    };
    window.addEventListener("cart:added", on);
    return () => window.removeEventListener("cart:added", on);
  }, []);
  return null;
}
