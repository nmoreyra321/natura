"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateSurchargeFromRealFees } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** Comprueba la comisión real de los últimos pagos y deja el recargo justo. */
export function UpdateFeeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await updateSurchargeFromRealFees();
          if (res.ok) {
            toast.success(res.message ?? "Listo.");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
      Comprobar y actualizar el recargo
    </Button>
  );
}
