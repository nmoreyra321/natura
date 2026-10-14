# Natu Mariel

Tienda online para vender productos Natura a precios especiales. Los clientes arman su carrito y envían el pedido por WhatsApp, sin crear una cuenta. Mariel administra el catálogo desde un panel privado en `/admin`.

- **Tienda pública:** inicio, catálogo con búsqueda, filtros (categoría, precio, ofertas), orden y paginación, fichas de producto, carrito (con panel lateral), buscador instantáneo, «Cómo comprar» con preguntas frecuentes, contacto y botón para instalarla como app en el celular.
- **Panel `/admin`:** login con email y contraseña, resumen del catálogo, pedidos (confirmar, entregar, cancelar; el stock se descuenta al confirmar), ventas del mes con gráficos y lo más vendido, productos (crear, editar, publicar, despublicar, eliminar, stock rápido, destacados y ofertas) con paginación, fotos (subir, reemplazar, ordenar y eliminar), categorías, actualización de precios desde Natura y estado de la configuración.
- **Catálogo inicial vacío:** no hay productos de ejemplo. Mientras no haya productos publicados, la tienda muestra "Estamos preparando algo lindo para vos."

## Tecnología

| Parte | Elección | Por qué |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript | Compatible con Vercel y con renderizado en servidor para SEO |
| Estilos | Tailwind CSS 4, componentes propios, Lucide | Identidad visual propia sin depender de una plantilla |
| Formularios | React Hook Form + Zod (las mismas reglas en el navegador y en el servidor) | Validación consistente |
| Notificaciones | Sonner | Mensajes cortos en español |
| Datos, login y fotos | Supabase (Postgres + Auth + Storage) | El repositorio no tenía base de datos. Supabase da persistencia real, login seguro y almacenamiento de fotos compatible con Vercel |

### Seguridad

- **RLS (Row Level Security)** en todas las tablas. El público solo puede leer los productos publicados, sus fotos y las categorías visibles. Solo las cuentas cargadas en `admin_users` pueden crear, editar o borrar.
- **Storage:** las fotos están en el bucket `product-images`, de lectura pública. Solo las administradoras pueden subir, reemplazar o borrar. Se aceptan JPG, PNG, WebP y AVIF de hasta 5 MB; esto se controla en el navegador y también en Supabase.
- **Restricciones en la base:** precios mayores a 0, stock entero y no negativo, URL (slug) válida y única, y una oferta exige un descuento real.
- **Doble chequeo de permisos:** cada acción del panel (Server Action) vuelve a verificar la sesión y el permiso de administradora.
- **Sin registro público.** Las administradoras se crean con un script que usa la clave secreta, que nunca llega al navegador.
- **El carrito no confía en el navegador:** antes de armar el mensaje de WhatsApp, vuelve a consultar en la base los precios y el stock vigentes.

## Estructura

```
src/app/(tienda)/          Tienda pública (inicio, productos, categorías, carrito, contacto)
src/app/admin/             Panel: login, (panel)/… y actions.ts (Server Actions)
src/components/store|admin Componentes de la tienda y del panel
src/lib/                   Precios, formato ARS, WhatsApp, validaciones, catálogo, auth, Supabase
src/proxy.ts               Protege /admin (refresca la sesión y redirige al login)
supabase/migrations/       Esquema SQL versionado (tablas, RLS, storage)
scripts/create-admin.mjs   Crea la cuenta administradora
tests/                     Unitarias (Vitest), permisos (rls-check.mjs) y navegador (Playwright)
```

## Puesta en marcha (producción)

### 1. Crear el proyecto de Supabase

1. Creá un proyecto en https://supabase.com. Elegí la región São Paulo (`sa-east-1`), que es la más cercana a Argentina.
2. Aplicá el esquema con **una** de estas dos opciones:
   - **SQL Editor:** pegá y ejecutá, en orden, el contenido de cada archivo de `supabase/migrations/` (esquema inicial, permisos, pedidos y código de Natura).
   - **CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <ref-del-proyecto>
     npx supabase db push
     ```
3. Desactivá el registro público en **Authentication → Sign In / Providers**:
   - Apagá **"Allow new users to sign up"**.
   - Dejá **encendido** el proveedor **Email**. Si lo apagás, tampoco se puede iniciar sesión.

### 2. Cargar las variables en Vercel

Andá a **Vercel → proyecto `natumariel` → Settings → Environment Variables** y cargá estas variables para Production, Preview y Development:

| Variable | Valor | ¿Secreta? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La "publishable key" (`sb_publishable_…`). También sirve la "anon key", cargada en `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No: los permisos los controla RLS |
| `NEXT_PUBLIC_SITE_URL` | Dominio definitivo, por ejemplo `https://natumariel.com.ar` (opcional) | No |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Dejala vacía hasta tener el número (ver más abajo) | No |

> La clave secreta (`SUPABASE_SECRET_KEY`) **no** se carga en Vercel: la app no la necesita.
>
> Las variables `NEXT_PUBLIC_*` se incorporan al compilar. Después de cambiarlas, hay que **volver a desplegar** (Deployments → Redeploy).

Mientras falten estas variables, el sitio funciona igual: la tienda muestra el estado "preparando" y `/admin` muestra "Configuración pendiente". No hay un login simulado.

### 3. Crear la cuenta administradora

Esto se hace **una sola vez**, desde tu computadora y nunca desde el navegador:

```bash
git clone https://github.com/nmoreyra321/natura && cd natura
npm install
# Usá la Secret key de Supabase → Project Settings → API Keys (o la service_role)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SECRET_KEY=sb_secret_xxx \
npm run admin:create -- mariel@sucorreo.com
```

- El script pide la contraseña sin mostrarla en pantalla. Debe tener al menos 10 caracteres, con mayúsculas, minúsculas y números.
- Si el correo ya existe en Supabase, solo lo convierte en administradora.
- **Alternativa sin consola:** creá el usuario en Supabase → Authentication → Users → "Add user" (marcá *Auto Confirm User*). Después ejecutá en el SQL Editor:
  ```sql
  insert into public.admin_users (user_id)
  select id from auth.users where email = 'mariel@sucorreo.com';
  ```

### 4. Desplegar

1. Conectá el repositorio de GitHub al proyecto de Vercel `natumariel` (Settings → Git), o ejecutá `vercel --prod`.
2. Vercel detecta Next.js solo: build `next build`, Node 20 o superior (el proyecto ya está en 24.x). No hace falta `vercel.json`.
3. Cuando termine el despliegue, entrá a `https://<tu-dominio>/admin`.

> El proyecto de Vercel tiene activada la **Vercel Authentication** (protección de despliegues). Para que el público vea la tienda, conectá un dominio propio o desactivala en **Settings → Deployment Protection**.

## Uso diario

### Entrar al panel

Abrí `/admin` e ingresá con tu **usuario** (por ejemplo `natumariel2026`) o tu correo, y la contraseña.

> Las cuentas con nombre de usuario se guardan en Supabase como `usuario@natumariel.vercel.app`, una dirección interna que no recibe correos. Cuando quieras usar un correo real, cambialo en Supabase → Authentication → Users.

### Cargar el primer producto

1. En el panel, tocá **Nuevo producto**.
2. Completá el nombre, la categoría, la presentación (por ejemplo, 200 ml) y la descripción.
3. Cargá los dos precios:
   - **Precio de revista:** el precio oficial de Natura.
   - **Precio especial Natu Mariel:** el precio al que lo vendés.

   El panel te muestra el descuento y el ahorro calculados.
4. Cargá el stock y tocá **Crear producto**. El producto queda como **borrador**.
5. Se abre la edición del producto: agregá las fotos. La primera foto es la principal.
6. Cambiá el estado a **Publicado** y guardá, o tocá **Publicar** desde el listado. El producto aparece en la tienda al instante, sin volver a desplegar.

### Categorías y líneas

Las **categorías** son el tipo de producto (Perfumería, Cuerpo y baño, Rostro, Cabello, Maquillajes…). La **línea** es la marca de Natura (Chronos, Ekos, Tododia, Una…) y se carga en el campo «Línea Natura» de cada producto. En la tienda se puede filtrar por categoría, por línea y marcar «Solo repuestos» (se detecta solo: todo producto con «repuesto» en el nombre).

### Formas de pago: efectivo, transferencia o Mercado Pago

En el carrito la clienta elige cómo pagar:

- **Efectivo**: el pedido se manda por WhatsApp, como siempre.
- **Transferencia** (sin comisión): aparece cuando cargás tu alias en **Panel → Configuración → Cobrar por transferencia**. La clienta ve el alias/CBU con botón para copiar, manda el pedido por WhatsApp y te envía el comprobante.
- **Mercado Pago**: la tienda la lleva a la página de Mercado Pago. Al volver ve si el pago se aprobó y puede avisarte por WhatsApp. Se activa cargando en Vercel la variable `MP_ACCESS_TOKEN` (ver `.env.example`) y volviendo a desplegar. En Configuración podés poner un **recargo %** para que la comisión la pague la clienta (se suma como una línea aparte en Mercado Pago). Mercado Pago avisa cada pago a `/api/mercadopago`; la tienda confirma el estado consultando a Mercado Pago, así un aviso falso no puede marcar nada como pagado.

En **Pedidos** cada pedido muestra cómo pagó: «Efectivo», «Transferencia», «Mercado Pago · Pagado», «Esperando pago» o «Rechazado».

### Venta rápida (ventas por fuera de la tienda)

En **Panel → Venta rápida** se cargan las ventas de los vivos de Facebook, en persona o por WhatsApp: buscás cada producto, ajustás cantidad (y precio si hiciste uno especial), elegís dónde se vendió, cómo pagó (todo, una parte o nada, con nota) y si ya lo entregaste. Al registrarla se descuenta el stock (y los vencimientos, primero el que vence antes) y queda en Pedidos y en Ventas con su origen.

### Quién me debe, avisos de stock y más vendidos

- **Quién me debe** (panel): clientas con pedidos sin cobrar o pagados en parte, cuánto deben y desde cuándo, con botón para recordarles por WhatsApp (si tiene el celular guardado va directo a su chat).
- **Avisos de stock** (panel): en los productos sin stock, la clienta toca «Avisame cuando vuelva» y deja su WhatsApp. Cuando cargás stock, tocás «Avisar» y se abre WhatsApp con el mensaje listo.
- **Inicio del panel**: avisa pedidos pendientes, lotes por vencer, plata por cobrar, clientas esperando productos y la lista «Para reponer».
- **Tienda**: botón «Compartir» en cada producto y sección «Los más vendidos» (últimos 90 días) en el inicio, que aparece cuando hay al menos 4 productos vendidos.

### Pedidos

Cuando una clienta toca **Hacer pedido por WhatsApp**, el pedido queda guardado con un número (por ejemplo *Pedido N.º 12*), que también aparece en el mensaje de WhatsApp. En **Pedidos**:

- **Confirmar:** descuenta del stock las unidades del pedido.
- **Marcar entregado:** cierra el pedido (el stock ya estaba descontado).
- **Cancelar** o **Volver a pendiente:** devuelve al stock lo que se había descontado.

Los precios del pedido los toma la base de datos, no el navegador. Las clientas no pueden ver ni modificar pedidos.

### Cargar stock con la factura de Natura (Productos → pestaña «Cargar factura»)

Cuando llega la caja de Natura: subí el PDF de la factura («Nota Fiscal») o sacale fotos (hasta 3 si es larga) y tocá **Leer la factura**. Los kits o cajas de regalo se separan en los productos que traen adentro, y como en la factura vienen abreviados, la IA los busca por nombre en el catálogo: los que no reconoce con seguridad aparecen con «¿Es este producto?» para confirmar. La inteligencia artificial de Google (Gemini) arma la lista con código, descripción y cantidad, y la cruza con los productos de la tienda por el código de Natura. En la lista se puede:

- Corregir cantidades con − / + (si llegó uno más o uno menos) o quitar un renglón con el tachito.
- Agregar un producto que llegó y no figura en la lista.
- Para los que **no están en la página**: crearlos como productos nuevos (nombre y precio de revista; quedan ocultos hasta que les pongas foto) o elegir a cuál producto existente corresponden.

Al **Confirmar** se suma todo al stock (no se reemplaza). Necesita la variable `GEMINI_API_KEY` en Vercel (se crea gratis en aistudio.google.com/apikey). Se usa el nivel gratis de Google, que alcanza de sobra para algunas boletas por mes; en ese nivel Google puede usar las fotos para mejorar su servicio. Opcional: `GEMINI_MODEL` para elegir otro modelo (por defecto `gemini-flash-latest`).

### Cargar stock rápido (Productos → pestaña «Cargar stock»)

En **Productos**, pestaña **Cargar stock**, está la lista de todos los productos con un casillero de cantidad. Escribí cuántos tenés y apretá **Enter**: se guarda y pasa al siguiente (también hay botones − / + para el celular). Con la opción **Publicar automáticamente** activada, cada producto al que le cargás stock se publica solo; los que quedan en 0 no cambian. Podés buscar por nombre, filtrar por categoría o ver solo los que están sin stock.

### Vencimientos

En **Vencimientos** cargás las fechas por lote, rápido y con el teclado: escribí parte del nombre, Enter, el vencimiento como figura en el envase (`0129` = 01/29, vence a fin de enero de 2029), la cantidad y Enter. El cursor vuelve solo al buscador para el siguiente; si cargás dos veces el mismo producto con la misma fecha, se suman las unidades.

La lista **Por vencer** muestra lo que vence en los próximos 3 meses (lo vencido, en rojo), y el inicio del panel avisa cuántos lotes hay. Al **confirmar un pedido** se descuentan solas las unidades de los lotes, empezando por el que vence primero (en el pedido figura de qué vencimiento salió cada una); si el pedido se cancela o vuelve a pendiente, vuelven a su lote. Para ventas fuera de la tienda, en cada lote podés **restar 1** o tocar **Ya no lo tengo**.

### Ventas

En **Ventas** ves, mes por mes, cuánto vendiste desde la tienda: total vendido (con la variación frente al mes anterior), cantidad de pedidos, ticket promedio, unidades, ventas por día, los últimos 6 meses y los productos más vendidos. Cuentan como venta los pedidos **confirmados** y **entregados**; los pendientes se muestran aparte y los cancelados no suman. Las fechas se toman en hora de Argentina.

### Actualizar precios cuando sale una revista

En **Precios Natura**, tocá **Buscar precios nuevos en Natura**. La tienda consulta cada producto que tiene código de Natura (por ejemplo `NATARG-2821`) y muestra los que cambiaron. Elegí cuáles aplicar:

- Si el precio especial era igual al de revista, acompaña el cambio.
- Si pusiste un precio especial propio, se mantiene.
- Si estaba en oferta y el especial ya no es menor, deja de ser oferta.

El código de Natura se puede cargar o corregir en la edición de cada producto.

### Estadísticas

La tienda envía visitas a **Vercel Web Analytics** (no cuenta las visitas al panel). Para verlas, activalo una vez en **Vercel → proyecto `natumariel` → Analytics → Enable**.

### Precios y descuentos

En cada producto podés poner el precio de dos formas: **Con % de descuento** (escribís el precio de revista y el %, por ejemplo 25, y el precio de venta se calcula solo) o **Precio final** (escribís directamente a cuánto lo vendés). Para varios a la vez: en Productos marcá los que quieras, escribí el % en la barra de abajo y tocá «Aplicar descuento».

```
descuento = ((precio de revista − precio especial) / precio de revista) × 100
```

- El precio especial siempre es el más destacado. El precio de revista aparece tachado solo si hay descuento.
- Si los dos precios son iguales, o si el especial es mayor, se muestra un solo precio y no se muestra oferta.
- El porcentaje se redondea hacia abajo para no prometer más descuento del real.
- Los importes se muestran en formato argentino, por ejemplo `$ 12.500,00`. Para cargarlos podés escribir `12500`, `12.500` o `12.500,50`.

## Configurar WhatsApp más adelante

1. En Vercel, cargá `NEXT_PUBLIC_WHATSAPP_NUMBER` con el número en formato internacional, **solo dígitos**:
   - Celular de Argentina: `549` + código de área sin el 0 + número sin el 15.
   - Ejemplo de formato: Buenos Aires `11 1234-5678` → `5491112345678`.
2. Volvé a desplegar.
3. Verificá en `/admin/configuracion` que diga "configurado" y hacé un pedido de prueba desde el carrito.

Mientras no esté configurado:

- El botón "Hacer pedido por WhatsApp" aparece deshabilitado, con una explicación para el cliente.
- No se generan enlaces rotos ni se muestra un número ficticio.
- El panel avisa que falta configurarlo.

El mensaje del pedido lista cada producto con cantidad, precio unitario y subtotal, más el total y el ahorro. Aclara que el pedido queda **pendiente de confirmación** de Mariel: no se reserva stock ni se confirma la compra. El carrito no se borra al enviar el pedido.

## Desarrollo local

```bash
npm install
cp .env.example .env.local      # completar con un proyecto de Supabase de prueba
npm run dev                     # http://localhost:3000
```

Con Supabase local (requiere Docker):

```bash
npx supabase start              # aplica supabase/migrations automáticamente
# Copiá API_URL y la publishable key a .env.local. Agregá NEXT_IMAGE_ALLOW_LOCAL_IP=1 (solo local)
```

## Pruebas

```bash
npm run lint && npm run typecheck && npm test   # lint, TypeScript y pruebas unitarias
npm run build                                   # build de producción
```

Contra una base **de prueba**, nunca contra producción:

```bash
# Permisos (RLS): anónimos y usuarios sin permisos no pueden modificar nada
ADMIN_EMAIL=… ADMIN_PASSWORD=… USER_EMAIL=… USER_PASSWORD=… node tests/rls-check.mjs

# Navegador (Playwright) con la app corriendo en :3000
E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_USER_EMAIL=… E2E_USER_PASSWORD=… npm run test:e2e

# WhatsApp con número de prueba, solo en desarrollo
NEXT_PUBLIC_WHATSAPP_NUMBER=5491100000000 npx next dev -p 3001
E2E_WHATSAPP=1 E2E_PRODUCT_SLUG=<slug-publicado> BASE_URL=http://localhost:3001 npx playwright test whatsapp
```

## Catálogo importado de Natura

El catálogo se cargó desde naturacosmeticos.com.ar con los scripts de `scripts/importar-natura/`:

- `crawl2.py` recorre las fichas de producto (semillas del sitemap y de las páginas de categoría, más los productos relacionados) y guarda lo que lee.
- `build.py` arma las filas: nombre, descripción, tamaño, categoría, precio de revista y fotos. Los productos con tonos entran como uno solo, con los tonos en la descripción.
- `datos/` tiene los lotes que se importaron.

Todos los productos entraron como **borrador**, con **stock 0** y **precio especial igual al de revista**. No se duplican productos cuyo nombre ya existía. Los que no encajan en tus categorías quedaron sin categoría para que la asignes desde el panel.

## Notas

- La ilustración del inicio es un SVG propio, sin texto. Si más adelante querés usar una foto, se reemplaza en `src/components/store/hero-art.tsx`.
- `npm audit` informa vulnerabilidades en `eslint-config-next` (herramienta de desarrollo). No afectan al sitio publicado.
- Si cambia el esquema de la base, regenerá los tipos con `npx supabase gen types typescript --local > src/lib/supabase/database.generated.ts`.
