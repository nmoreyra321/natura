"use client";

import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
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

type Mode = "none" | "prompt" | "ios" | "android";

function getMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "none";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  // Android sin aviso del navegador (otro navegador, o ya lo rechazó): se explica a mano.
  return /Android/.test(ua) ? "android" : "none";
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

type Browser = "chrome" | "safari" | "other" | "android";

function detectBrowser(): Browser {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Android/.test(ua)) return "android";
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return "other";
  return "safari";
}

/**
 * Mini animación en bucle con los pasos reales de cada celular:
 * - Chrome en iPhone: Compartir → Ver más → Añadir a pantalla de inicio → Agregar.
 * - Safari: Compartir → Agregar a pantalla de inicio → Agregar.
 * - Android: ⋮ → Agregar a la pantalla principal → Agregar.
 */
function InstallDemo({ browser }: { browser: Browser }) {
  const android = browser === "android";
  const iosChrome = browser === "chrome";
  const shareTop = iosChrome || android;
  const share = shareTop ? { x: 123, y: 6 } : { x: 31, y: 234 };
  const verMas = iosChrome ? { x: 114, y: 196 } : share;
  const row = android ? { x: 79, y: 69 } : { x: 59, y: 205 };
  const add = android ? { x: 99, y: 151 } : { x: 117, y: 7 };
  const addLabel = iosChrome ? "Añadir a pantalla de inicio" : "Agregar a pantalla de inicio";
  const vars = {
    "--sx": `${share.x}px`,
    "--sy": `${share.y}px`,
    "--vx": `${verMas.x}px`,
    "--vy": `${verMas.y}px`,
    "--rx": `${row.x}px`,
    "--ry": `${row.y}px`,
    "--ax": `${add.x}px`,
    "--ay": `${add.y}px`,
  } as React.CSSProperties;

  const shareIcon = <Share className="size-3.5 text-[#0a84ff]" aria-hidden="true" />;
  const urlBar = (
    <div className="flex h-7 flex-1 items-center justify-center rounded-full bg-[#ececf0] text-[8px] text-neutral-600">
      natumariel.vercel.app
    </div>
  );
  const appIcon = (size: string, extra = "") => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/icon-192.png" alt="" className={`${size} rounded-[8px] ${extra}`} />
  );

  return (
    <figure className="idemo mt-4 flex flex-col items-center motion-reduce:hidden" aria-hidden="true">
      <div className="relative h-[284px] w-[164px] rounded-[30px] bg-neutral-900 p-[7px] shadow-lift">
        <div className="relative h-[270px] w-[150px] overflow-hidden rounded-[23px] bg-white" style={vars}>
          {/* La tienda abierta en el navegador */}
          <div className="idemo-store absolute inset-0 flex flex-col">
            {shareTop ? (
              <div className="flex items-center gap-1 px-1.5 pt-2.5">
                {urlBar}
                <span className="flex size-6 items-center justify-center">
                  {android ? <EllipsisVertical className="size-3.5 text-neutral-700" aria-hidden="true" /> : shareIcon}
                </span>
              </div>
            ) : null}
            <div className="flex-1 bg-cream px-2.5 pt-2.5">
              <div className="flex items-center gap-1">
                {appIcon("size-4", "rounded")}
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

          {android ? (
            /* Android: menú de los tres puntitos */
            <div className="idemo-menu absolute top-1.5 right-1.5 w-[124px] origin-top-right rounded-lg bg-white py-1 text-[8px] text-neutral-800 shadow-[0_4px_16px_rgb(0_0_0/0.2)]">
              <div className="flex h-5 items-center px-2.5">Nueva pestaña</div>
              <div className="flex h-5 items-center px-2.5">Historial</div>
              <div className="flex h-5 items-center px-2.5">Compartir…</div>
              <div className="idemo-row flex h-5 items-center px-2.5 font-semibold whitespace-nowrap">
                Agregar a la pantalla principal
              </div>
              <div className="flex h-5 items-center px-2.5">Configuración</div>
            </div>
          ) : (
            <>
              {iosChrome ? (
                /* Hoja de Compartir: hay que tocar "Ver más" */
                <div className="idemo-sheet-a absolute inset-x-0 bottom-0 h-[110px] rounded-t-2xl bg-[#2c2c2e] px-2 text-white">
                  <p className="flex h-7 items-center gap-1 pt-1 text-[8px] font-semibold">
                    {appIcon("size-4", "rounded")} Natu Mariel | Productos Natura
                  </p>
                  <div className="mt-[8px] grid grid-cols-4 text-center text-[6px] leading-tight text-neutral-300">
                    {["Copiar", "Enviar", "Lista de lectura", "Ver más"].map((label, i) => (
                      <span key={label} className="flex flex-col items-center gap-0.5">
                        <span className="flex size-[22px] items-center justify-center rounded-full bg-[#48484a] text-[10px]">
                          {i === 3 ? "⌄" : ""}
                        </span>
                        <span className={i === 3 ? "font-bold text-white" : ""}>{label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* Lista con la opción para agregar a la pantalla de inicio */}
              <div
                className={`${iosChrome ? "idemo-sheet-b" : "idemo-sheet-b-early"} absolute inset-x-0 bottom-0 h-[150px] rounded-t-2xl bg-[#2c2c2e] px-2 text-[8px] text-white`}
              >
                <p className="flex h-[22px] items-center gap-1 pt-1 font-semibold">
                  {appIcon("size-3.5", "rounded")} natumariel.vercel.app
                </p>
                <div className="mt-1 overflow-hidden rounded-lg bg-[#3a3a3c]">
                  {(iosChrome
                    ? ["Añadir a marcadores", "Crear un código QR", "Buscar en página"]
                    : ["Copiar", "Agregar a favoritos", "Buscar en página"]
                  ).map((label) => (
                    <div key={label} className="flex h-[18px] items-center border-b border-white/10 px-2 last:border-0">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 overflow-hidden rounded-lg bg-[#3a3a3c]">
                  <div className="idemo-row flex h-5 items-center gap-1 px-2 font-semibold whitespace-nowrap">
                    <SquarePlus className="size-3" aria-hidden="true" /> {addLabel}
                  </div>
                  <div className="flex h-5 items-center px-2 text-neutral-300">Añadir a nota rápida</div>
                </div>
              </div>
            </>
          )}

          {/* Confirmar: botón Agregar */}
          {android ? (
            <div className="idemo-confirm absolute inset-0 bg-black/40">
              <div className="absolute inset-x-3 top-[80px] h-[100px] rounded-xl bg-white p-2.5 text-[8px] text-neutral-800">
                <p className="font-bold">Agregar a la pantalla principal</p>
                <p className="mt-2 flex items-center gap-1.5">
                  {appIcon("size-5")} Natu Mariel
                </p>
                <p className="absolute right-2.5 bottom-2 flex gap-3 font-bold text-[#1a73e8]">
                  <span>Cancelar</span>
                  <span className="idemo-add">Agregar</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="idemo-confirm absolute inset-0 bg-[#1c1c1e] px-2 text-[8px] text-white">
              <div className="flex h-9 items-center justify-between">
                <span className="text-neutral-400">✕</span>
                <span className="font-semibold">Agregar a Inicio</span>
                <span className="idemo-add rounded-full bg-[#0a84ff] px-2 py-1 font-bold">Agregar</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#2c2c2e] p-2">
                {appIcon("size-7")}
                <span>
                  Natu Mariel
                  <span className="block text-[6px] text-neutral-400">natumariel.vercel.app</span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#2c2c2e] p-2">
                Abrir como app web
                <span className="h-3 w-5 rounded-full bg-[#30d158]" />
              </div>
            </div>
          )}

          {/* Pantalla de inicio con el ícono */}
          <div className="idemo-home absolute inset-0 bg-gradient-to-b from-[#c9b6e4] to-[#f6c6d9] px-3 pt-8">
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-3">
              {["#34c759", "#0a84ff", "#ff9f0a", "#ff375f", "#5e5ce6", "#64d2ff", "#30d158"].map((c) => (
                <span key={c} className="size-[26px] rounded-[8px]" style={{ background: c }} />
              ))}
              <span className="flex flex-col items-center gap-0.5">
                {appIcon("size-[26px]", "idemo-icon shadow")}
                <span className="text-[6px] font-semibold whitespace-nowrap text-white">Natu Mariel</span>
              </span>
            </div>
          </div>

          {/* Dedo */}
          <span className="idemo-finger absolute top-0 left-0 size-[22px] rounded-full border-2 border-white bg-forest/45 shadow" />
        </div>
      </div>
      <figcaption className="relative mt-3 h-5 w-full text-center text-sm font-bold">
        <span className="idemo-cap1 absolute inset-0">{android ? "1. Tocá los tres puntitos ⋮" : "1. Tocá Compartir"}</span>
        <span className="idemo-cap2 absolute inset-0">
          {android ? "2. Agregar a la pantalla principal" : iosChrome ? "2. Ver más → Añadir a pantalla de inicio" : "2. Agregar a pantalla de inicio"}
        </span>
        <span className="idemo-cap3 absolute inset-0">3. Tocá Agregar</span>
        <span className="idemo-cap4 absolute inset-0">¡Listo! Ya tenés la app</span>
      </figcaption>
    </figure>
  );
}

/**
 * Botón "Instalar app": si el navegador lo permite (Chrome en Android, compus) abre su aviso de instalación;
 * en iPhone, y en Android cuando no hay aviso, muestra cómo hacerlo con una mini animación.
 */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const mode = useInstallMode();
  const [showHelp, setShowHelp] = useState(false);
  const [tab, setTab] = useState<"iphone" | "android">("iphone");
  const [iosNav, setIosNav] = useState<"safari" | "chrome">("safari");
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
            const detected = detectBrowser();
            setTab(detected === "android" ? "android" : "iphone");
            setIosNav(detected === "chrome" ? "chrome" : "safari");
            setShowHelp(true);
          }
        }}
      >
        <Download className="size-4.5" aria-hidden="true" />
        Instalar app
      </button>
      {mode === "ios" || mode === "android" ? (
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
          <div role="tablist" aria-label="Tipo de celular" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-cream p-1">
            {(
              [
                ["iphone", "iPhone"],
                ["android", "Android"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full py-2 text-sm font-bold ${tab === value ? "bg-forest text-white" : "hover:bg-sun"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "iphone" ? (
            <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm">
              <span className="text-muted">Navegador:</span>
              {(
                [
                  ["safari", "Safari"],
                  ["chrome", "Chrome"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={iosNav === value}
                  onClick={() => setIosNav(value)}
                  className={`rounded-full border px-3 py-1 font-semibold ${iosNav === value ? "border-forest bg-forest/10" : "border-line hover:bg-sun"}`}
                >
                  {label}
                </button>
              ))}
            </p>
          ) : null}

          {showHelp ? (
            <InstallDemo key={tab === "android" ? "android" : iosNav} browser={tab === "android" ? "android" : iosNav} />
          ) : null}

          <ol className="mt-4 flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun">
                {tab === "android" ? (
                  <EllipsisVertical className="size-4.5" aria-hidden="true" />
                ) : (
                  <Share className="size-4.5" aria-hidden="true" />
                )}
              </span>
              <span>
                {tab === "android" ? (
                  <>
                    Tocá los <strong>tres puntitos ⋮</strong> del navegador, arriba a la derecha.
                  </>
                ) : iosNav === "chrome" ? (
                  <>
                    Tocá <strong>Compartir</strong> (el cuadrado con la flecha), arriba a la derecha al lado de la
                    dirección.
                  </>
                ) : (
                  <>
                    Tocá <strong>Compartir</strong> (el cuadrado con la flecha), abajo. Si no lo ves, tocá primero los{" "}
                    <strong>tres puntitos ⋯</strong>.
                  </>
                )}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage">
                <SquarePlus className="size-4.5" aria-hidden="true" />
              </span>
              <span>
                {tab === "android" ? (
                  <>
                    Elegí <strong>Agregar a la pantalla principal</strong> (o <strong>Instalar app</strong>).
                  </>
                ) : iosNav === "chrome" ? (
                  <>
                    Tocá <strong>Ver más</strong>, bajá y elegí <strong>Añadir a pantalla de inicio</strong>.
                  </>
                ) : (
                  <>
                    Bajá y elegí <strong>Agregar a pantalla de inicio</strong>.
                  </>
                )}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lilac font-bold">3</span>
              <span>
                Tocá <strong>Agregar</strong> y listo: el ícono aparece en tu pantalla.
              </span>
            </li>
          </ol>
          <p className="mt-4 text-sm text-muted">La tienda queda como una app en tu pantalla de inicio.</p>
        </dialog>
      ) : null}
    </>
  );
}
