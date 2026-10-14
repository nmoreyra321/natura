"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Evento de Chrome/Android para ofrecer la instalación (no está en los tipos del DOM). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// El navegador puede avisar antes de que se monte el botón: se guarda a nivel de módulo.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

type Mode = "none" | "prompt" | "ios";

function getMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "none";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIOS ? "ios" : "none";
}

function useInstallMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getMode,
    () => "none",
  );
}

/** Primer paso en iPhone: dónde está el botón Compartir depende del navegador. */
function iosShareStep() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/CriOS/.test(ua)) {
    return (
      <>
        Tocá el botón <strong>Compartir</strong> de Chrome: el cuadrado con la flecha, arriba a la derecha, al lado de
        la dirección.
      </>
    );
  }
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) {
    return (
      <>
        Tocá el menú del navegador y elegí <strong>Compartir</strong>.
      </>
    );
  }
  return (
    <>
      Tocá el botón <strong>Compartir</strong> de Safari (el cuadrado con la flecha). Si no lo ves, tocá primero los{" "}
      <strong>tres puntitos ⋯</strong>.
    </>
  );
}

/** Botón "Instalar app": en Android/Chrome abre el aviso del navegador; en iPhone muestra cómo hacerlo. */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const mode = useInstallMode();
  const [showHelp, setShowHelp] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showHelp && !dialog.open) dialog.showModal();
    if (!showHelp && dialog.open) dialog.close();
  }, [showHelp]);

  if (mode === "none") return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (mode === "prompt" && deferred) {
            const event = deferred;
            await event.prompt();
            await event.userChoice;
            deferred = null;
            emit();
          } else {
            setShowHelp(true);
          }
        }}
      >
        <Download className="size-4.5" aria-hidden="true" />
        Instalar app
      </button>
      {mode === "ios" ? (
        <dialog
          ref={dialogRef}
          onClose={() => setShowHelp(false)}
          aria-labelledby="instalar-titulo"
          className="m-auto w-[min(92vw,380px)] rounded-3xl border-2 border-forest bg-warm-white p-6 text-forest shadow-[4px_4px_0_var(--forest)] backdrop:bg-forest/40"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="instalar-titulo" className="font-display text-xl font-bold">
              Instalá Natu Mariel
            </h2>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="-mt-1 -mr-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-forest/5"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun">
                <Share className="size-4.5" aria-hidden="true" />
              </span>
              <span>{iosShareStep()}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage">
                <SquarePlus className="size-4.5" aria-hidden="true" />
              </span>
              <span>
                Bajá un poco y elegí <strong>Agregar a pantalla de inicio</strong>. Si no aparece, tocá{" "}
                <strong>Ver más</strong>.
              </span>
            </li>
          </ol>
          <p className="mt-4 text-sm text-muted">La tienda queda como una app en tu pantalla de inicio.</p>
        </dialog>
      ) : null}
    </>
  );
}
