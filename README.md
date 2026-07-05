# Cotizador · Fluid Solutions Business Center

App local de cotizaciones, catálogo de productos y fichas técnicas. Corre en **un notebook de la oficina** (el "servidor") y el resto del equipo la usa desde su navegador, dentro de la misma red WiFi. No necesita internet ni página web.

## 1. Elegir el notebook "servidor"

Debe ser el equipo que quede encendido mientras el equipo trabaja con el cotizador (idealmente uno que esté siempre en la oficina). Ahí es donde vive la información: productos, cotizaciones y fichas.

**Requisito:** tener [Node.js](https://nodejs.org) instalado (versión 22 o superior). Se instala una sola vez, como cualquier programa.

## 2. Primera vez: instalar

1. Copie toda esta carpeta (`fluidsolutions-cotizador`) al notebook servidor.
2. Haga doble clic en:
   - **Windows:** `Iniciar-Windows.bat`
   - **Mac:** `Iniciar-Mac.command`
3. La primera vez instalará automáticamente lo necesario (toma 1-2 minutos). Después se abrirá una ventana negra que debe **dejar abierta** mientras trabajen.

## 3. Usar la app

- **En el mismo notebook servidor:** abra su navegador (Chrome, Edge, Safari) y vaya a `http://localhost:8090`
- **En los otros 2 notebooks (misma WiFi):** la ventana que se abrió muestra direcciones como `http://192.168.1.XX:8090` — copie esa dirección en el navegador de cada equipo. Guárdela en favoritos para no tener que buscarla cada vez.

## 4. Primeros pasos dentro de la app

1. **Configuración** → cargue el logo, nombre, RUT, correo y datos de Fluid Solutions. Esto aparece en todas las cotizaciones y fichas impresas.
2. **Productos** → cargue su catálogo real (nombre, código, precio, imagen). Reemplace o borre los productos de ejemplo.
3. **Fichas técnicas** → para cada producto, complete sus especificaciones (se organizan en secciones).
4. **Cotizaciones** → cree una nueva, elija el cliente, agregue productos (autocompleta precio e imagen) o escriba ítems libres, y el sistema calcula Neto, IVA y Total solo. Botón **"Ver / PDF"** abre la versión lista para imprimir o guardar como PDF.

## 5. Trabajar con más de una empresa

El sistema soporta **varias empresas dentro de una misma instalación**, totalmente separadas entre sí (cada una con su propio catálogo, cotizaciones, clientes, correlativo y logo). Útil si una misma persona maneja más de un negocio.

- En el sidebar, arriba, está el selector **"Empresa activa"** — todo lo que vea y cree queda guardado bajo esa empresa.
- La sección **Empresas** permite crear una nueva, cambiar entre ellas o eliminar una (esto último borra TODOS sus datos, sin vuelta atrás).
- Las cotizaciones y fichas impresas siempre muestran los datos de la empresa que las generó, sin importar cuál esté activa al momento de abrir el PDF.

## 6. Documento completo (portada + cotización + datasheets + Términos)

Para cotizaciones que deban subirse a una plataforma de un cliente (con toda la documentación técnica adjunta), cada cotización guardada tiene un botón **"📎 Generar documento completo"** que arma un solo PDF con:

1. Portada (con el primer ítem destacado)
2. La cotización
3. El **datasheet del fabricante** de cada producto (si lo cargó en el Catálogo)
4. Los **Términos y Condiciones** de la empresa

**Antes de usarlo, complete:**
- En **Configuración** → bloque "Términos y Condiciones" (se usa en todas las cotizaciones).
- En **Productos** → suba el datasheet PDF de cada producto (junto a su imagen). Si algún producto no tiene datasheet cargado, el sistema avisa antes de generar y ofrece usar la **Ficha Técnica** de ese producto en su lugar.

## 7. Respaldos

Toda la información vive en un solo archivo: `data/fluidsolutions.db`. Para respaldar, copie la carpeta `data/` completa a un pendrive o a la nube de vez en cuando (por ejemplo, cada viernes).

## 8. Inicio automático (opcional)

Si prefiere que el cotizador arranque solo cada vez que prenden el notebook servidor, sin tener que abrir `Iniciar-Windows.bat` a mano:

1. Primero abra `Iniciar-Windows.bat` normalmente **al menos una vez** (para que se complete la instalación inicial y Windows registre el permiso de red la primera vez que pregunte).
2. Haga **clic derecho** sobre `Activar-Inicio-Automatico.bat` → **"Ejecutar como administrador"**.
3. Listo — desde ahora arranca solo, sin mostrar ninguna ventana, cada vez que el notebook **ENCIENDA** (no depende de con qué usuario se inicie sesión).
4. Para desactivarlo, use `Desactivar-Inicio-Automatico.bat` (también como administrador).

Para probarlo sin reiniciar el equipo, ejecute como administrador:
```
schtasks /Run /TN "FluidSolutionsCotizador"
```
y luego revise el archivo `data\inicio-automatico.log` — ahí queda registrado cada intento de arranque (y el motivo si algo falla).

⚠️ **Importante:** nunca abra `Iniciar-Windows.bat` manualmente mientras el inicio automático ya esté corriendo (o viceversa) — dos copias del sistema abiertas al mismo tiempo pueden dañar la información guardada. Si intenta abrir una segunda copia por error, el sistema se lo va a impedir automáticamente y le va a avisar en pantalla.

Si activó el inicio automático y no funcionó, corra `Desactivar-Inicio-Automatico.bat` y luego `Activar-Inicio-Automatico.bat` de nuevo (como administrador) para volver a registrar la tarea correctamente, y revise `data\inicio-automatico.log` para ver el detalle.

## 9. Recomendaciones

- En el router de la oficina, asigne una **IP fija** al notebook servidor para que la dirección no cambie (pregúntele a quien administre el WiFi, es un ajuste de una vez).
- Si el notebook servidor se apaga o se desconecta del WiFi, los otros dos no podrán acceder hasta que vuelva a estar disponible — es la única limitación de correr todo local, sin internet.
- Para cerrar la app, simplemente cierre la ventana negra que quedó abierta (o, si usa inicio automático, reinicie el notebook o desactívelo con el script del punto 8).

## Notas técnicas (para quien dé soporte)

- Node.js + Express, base de datos SQLite (módulo nativo `node:sqlite`, sin dependencias que requieran compilación).
- Sin autenticación: cualquiera en la red local puede ver y editar. Adecuado para un equipo de confianza; si más adelante se necesita login, es un agregado menor.
- Imágenes de productos, logos y datasheets PDF se guardan en `data/uploads/`.
- Puerto por defecto: `8090` (configurable con la variable de entorno `PORT`).
- El "Documento completo" usa Puppeteer (Chromium embebido, se descarga en el primer `npm install`, ~250-300MB) para renderizar las páginas y `pdf-lib` para fusionarlas con los datasheets. Si un datasheet PDF tiene una estructura interna dañada (pasa con algunos PDF corporativos), se salta esa página con aviso en vez de fallar todo el documento.
