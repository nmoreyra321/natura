"use client";

import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

/** «Avisos de pedidos en este celular»: activar, probar y desactivar. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !PUBLIC_KEY) {
        if (alive) setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (alive) setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      if (alive) setState(sub ? "on" : "off");
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) });
      const res = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      if (res.ok) {
        toast.success(res.message ?? "Avisos activados.");
        setState("on");
      } else {
        await sub.unsubscribe();
        toast.error(res.error);
      }
    } catch {
      toast.error("No pudimos activar los avisos en este celular.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Avisos desactivados en este celular.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  // En el inicio solo aparece mientras falta activarlos (en la compu, si no se puede, no molesta).
  if (compact && (state === "on" || state === "unsupported")) return null;

  return (
    <div className="rounded-3xl bg-warm-white p-4 shadow-soft">
      <p className="flex items-center gap-2 font-bold">
        <BellRing className="size-5 text-coral-deep" aria-hidden="true" /> Avisos de pedidos en este celular
      </p>
      {state === "on" ? (
        <>
          <p className="mt-1 text-sm text-muted">Activados: te llega un aviso con cada pedido nuevo, pago avisado o cancelación.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const res = await sendTestPush();
                if (res.ok) toast.success(res.message ?? "Enviado.");
                else toast.error(res.error);
              }}
              className={buttonClasses("outline", "sm")}
            >
              <Send className="size-4" aria-hidden="true" /> Probar
            </button>
            <button type="button" disabled={busy} onClick={turnOff} className={buttonClasses("ghost", "sm")}>
              <BellOff className="size-4" aria-hidden="true" /> Desactivar
            </button>
          </div>
        </>
      ) : state === "off" ? (
        <>
          <p className="mt-1 text-sm text-muted">Te avisamos al instante cuando entra un pedido, como un mensaje de WhatsApp.</p>
          <button type="button" disabled={busy} onClick={turnOn} className={buttonClasses("primary", "md", "mt-3")}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BellRing className="size-4" aria-hidden="true" />}
            Activar avisos
          </button>
        </>
      ) : state === "ios-install" ? (
        <p className="mt-1 text-sm text-muted">
          En el iPhone, primero instalá la app: en Safari tocá Compartir → «Agregar a pantalla de inicio». Después abrí la app desde
          el ícono, entrá al panel y volvé acá para activar los avisos.
        </p>
      ) : state === "blocked" ? (
        <p className="mt-1 text-sm text-muted">
          Los avisos están bloqueados en este celular. Activalos en los ajustes del celular (Notificaciones → Natu Mariel) y
          volvé a abrir esta pantalla.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Este navegador no permite avisos. Probá desde la app instalada en el celular.</p>
      )}
    </div>
  );
}
