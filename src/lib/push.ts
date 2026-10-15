import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:avisos@natumariel.app", pub, priv);
  configured = true;
  return true;
}

/**
 * Manda un aviso a los celulares de las administradoras que lo activaron.
 * Nunca falla hacia afuera: si no se puede avisar, el pedido igual sigue su curso.
 */
export async function notifyAdmins(message: PushMessage): Promise<void> {
  try {
    if (!configure()) return;
    const admin = createAdminClient();
    if (!admin) return;
    const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").limit(20);
    if (!subs?.length) return;
    const payload = JSON.stringify(message);
    const gone: string[] = [];
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
          .catch((e: { statusCode?: number }) => {
            // 404/410: el celular desactivó los avisos o se desinstaló la app.
            if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);
            else console.error("[avisos] No se pudo mandar:", e?.statusCode);
          }),
      ),
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  } catch (e) {
    console.error("[avisos] Error:", (e as Error).message);
  }
}
