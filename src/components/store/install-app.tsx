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

type Browser = "chrome" | "safari" | "other";

function iosBrowser(): Browser {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return "other";
  return "safari";
}

/**
 * Mini animación en bucle de los 3 pasos (Compartir → Agregar a pantalla de inicio → ícono en el inicio).
 * En Chrome el botón Compartir está arriba; en Safari, abajo.
 */
function InstallDemo({ browser }: { browser: Browser }) {
  const shareTop = browser === "chrome";
  const shareIcon = <Share className="size-3.5 text-[#0a84ff]" aria-hidden="true" />;
  const urlBar = (
    <div className="flex h-7 flex-1 items-center justify-center rounded-full bg-[#ececf0] text-[8px] text-neutral-600">
      natumariel.vercel.app
    </div>
  );
  return (
    <figure className="idemo mt-4 flex flex-col items-center motion-reduce:hidden" aria-hidden="true">
      <div className="relative h-[284px] w-[164px] rounded-[30px] bg-neutral-900 p-[7px] shadow-lift">
        <div
          className="relative h-[270px] w-[150px] overflow-hidden rounded-[23px] bg-white"
          style={{ ["--sx" as string]: shareTop ? "123px" : "31px", ["--sy" as string]: shareTop ? "6px" : "234px" }}
        >
          {/* 1. La tienda abierta en el navegador */}
          <div className="idemo-store absolute inset-0 flex flex-col">
            {shareTop ? (
              <div className="flex items-center gap-1 px-1.5 pt-2.5">
                {urlBar}
                <span className="flex size-6 items-center justify-center">{shareIcon}</span>
              </div>
            ) : null}
            <div className="flex-1 bg-cream px-2.5 pt-2.5">
              <div className="flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192.png" alt="" className="size-4 rounded" />
                <span className="font-display text-[10px] font-bold text-forest">Natu Mariel</span>
              </div>
              <div className="mt-2.5 h-2.5 w-24 rounded-full bg-forest/80" />
              <div className="mt-1.5 h-2.5 w-20 rounded-full bg-coral-deep/80" />
              <div className="mt-3 h-5 w-16 rounded-full bg-coral-deep" />
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <div className="h-14 rounded-lg bg-lilac" />
                <div className="h-14 rounded-lg bg-sage" />
              </div>
            </div>
            {!shareTop ? (
              <div className="flex items-center gap-1 bg-[#f7f7f9] px-1.5 pt-1.5 pb-3">
                <span className="flex size-6 items-center justify-center text-[10px] text-neutral-400">‹</span>
                <span className="flex size-6 items-center justify-center">{shareIcon}</span>
                {urlBar}
              </div>
            ) : null}
          </div>

          {/* 2. Menú Compartir */}
          <div className="idemo-sheet absolute inset-x-0 bottom-0 h-[130px] rounded-t-2xl bg-[#f2f2f7] px-2 shadow-[0_-4px_14px_rgb(0_0_0/0.12)]">
            <p className="pt-2 text-center text-[8px] text-neutral-500">natumariel.vercel.app</p>
            <div className="mt-1.5 overflow-hidden rounded-xl bg-white text-[9px] text-neutral-800">
              <div className="flex h-[22px] items-center justify-between border-b border-neutral-200 px-2">
                Copiar <span className="text-neutral-400">⧉</span>
              </div>
              <div className="idemo-row flex h-[22px] items-center justify-between border-b border-neutral-200 px-2 text-[8px] font-semibold whitespace-nowrap">
                Agregar a pantalla de inicio <SquarePlus className="size-3" />
              </div>
              <div className="flex h-[22px] items-center justify-between px-2">
                Agregar a favoritos <span className="text-neutral-400">☆</span>
              </div>
            </div>
          </div>

          {/* 3. Pantalla de inicio con el ícono */}
          <div className="idemo-home absolute inset-0 bg-gradient-to-b from-[#c9b6e4] to-[#f6c6d9] px-3 pt-8">
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-3">
              {["#34c759", "#0a84ff", "#ff9f0a", "#ff375f", "#5e5ce6", "#64d2ff", "#30d158"].map((c) => (
                <span key={c} className="size-[26px] rounded-[8px]" style={{ background: c }} />
              ))}
              <span className="flex flex-col items-center gap-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192.png" alt="" className="idemo-icon size-[26px] rounded-[8px] shadow" />
                <span className="text-[6px] font-semibold whitespace-nowrap text-white">Natu Mariel</span>
              </span>
            </div>
          </div>

          {/* Dedo */}
          <span className="idemo-finger absolute top-0 left-0 size-[22px] rounded-full border-2 border-white bg-forest/45 shadow" />
        </div>
      </div>
      <figcaption className="relative mt-3 h-5 w-full text-center text-sm font-bold">
        <span className="idemo-cap1 absolute inset-0">1. Tocá Compartir</span>
        <span className="idemo-cap2 absolute inset-0">2. Agregar a pantalla de inicio</span>
        <span className="idemo-cap3 absolute inset-0">3. ¡Listo! Ya tenés la app</span>
      </figcaption>
    </figure>
  );
}

/** Primer paso en iPhone: dónde está el botón Compartir depende del navegador. */
function iosShareStep() {
  const browser = iosBrowser();
  if (browser === "chrome") {
    return (
      <>
        Tocá el botón <strong>Compartir</strong> de Chrome: el cuadrado con la flecha, arriba a la derecha, al lado de
        la dirección.
      </>
    );
  }
  if (browser === "other") {
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
          {showHelp ? <InstallDemo browser={iosBrowser()} /> : null}
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
