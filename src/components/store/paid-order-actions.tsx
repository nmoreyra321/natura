"use client";

import { useEffect } from "react";

import { cart } from "@/lib/cart-store";

/** Pedido pagado: vacía el carrito (a Natu Mariel ya le llega el aviso al celular). */
export function PaidOrderActions() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}
