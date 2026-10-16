"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveLoyaltyMinTotal } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { parseMoney } from "@/lib/validation";

/** Monto mínimo del pedido para que sume al Club. */
export function LoyaltyMinForm({ current }: { current: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current).replace(".", ","));
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = value.trim() === "" ? 0 : parseMoney(value);
        start(async () => {
          const res = await saveLoyaltyMinTotal(n);
          if (res.ok) {
            toast.success(res.message ?? "Guardado.");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <label className="flex flex-col text-sm font-semibold">
        Suman los pedidos desde (0 = suman todos)
        <span className="mt-1 flex items-center gap-1">
          <span>$</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 w-32 rounded-xl border border-line bg-white px-2 tabular"
          />
        </span>
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm", "h-10")}>
        Guardar
      </button>
    </form>
  );
}
