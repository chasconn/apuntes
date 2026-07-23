# Migración de correos: GoDaddy → BlueHosting

> Apunte técnico preparado a partir del mensaje de voz de Carlos (23-jul).
> **Contexto:** el sitio web ya se migró a BlueHosting, pero los buzones de correo
> siguen alojados en GoDaddy. Hay que migrar los correos (mensajes + cuentas) y
> apuntar el dominio a BlueHosting, con respaldo completo y ventana en fin de semana.

---

## 0. Antes de la reunión (mañana en oficina) — preguntas a Carlos

Sin estos datos no se puede planificar bien. Confirmar:

- [ ] **¿Es BlueHosting o "Ninja"?** Carlos dudó del proveedor destino. Confirmar el panel real.
- [ ] **Dominio(s)** afectados (ej. `empresa.cl`) y cuántos.
- [ ] **Listado de cuentas de correo** a migrar y tamaño aproximado de cada buzón.
- [ ] **Credenciales / accesos:**
  - [ ] Panel de GoDaddy (cPanel o Workspace/Microsoft 365 — ¡importante saber cuál!).
  - [ ] Panel de BlueHosting (cPanel).
  - [ ] Contraseñas de cada buzón (o capacidad de resetearlas).
  - [ ] **Quién controla el DNS del dominio** (registrar) → es quien cambia los registros MX al final.
- [ ] **Ventana de mantenimiento** exacta del fin de semana (día y hora de inicio).
- [ ] ¿Hay clientes de correo (Outlook/móvil) que habrá que reconfigurar después?

> ⚠️ **Clave:** averiguar si el correo en GoDaddy es **cPanel Email** (IMAP estándar) o
> **GoDaddy Workspace / Microsoft 365**. El método de migración cambia por completo.
> El síntoma "se cierra/abre" suele ser MX/DNS inconsistente o autenticación fallando.

---

## 1. Preparación

- [ ] Documentar la configuración **actual** (registros MX, SPF, DKIM, DMARC) del dominio:
  ```bash
  dig +short MX empresa.cl
  dig +short TXT empresa.cl          # SPF
  dig +short TXT default._domainkey.empresa.cl   # DKIM (si aplica)
  ```
- [ ] Anotar servidores IMAP/SMTP de origen (GoDaddy) y destino (BlueHosting).
- [ ] **Bajar el TTL** de los registros MX en el DNS a 300s (5 min) **al menos 24 h antes**
      de la migración → así el cambio propaga rápido el fin de semana.
- [ ] Crear en **BlueHosting** todas las cuentas de correo con los mismos nombres que en GoDaddy.
- [ ] Verificar cuota de disco en BlueHosting ≥ suma de todos los buzones + margen.

---

## 2. Respaldo completo (hacer SIEMPRE antes de tocar nada)

**Opción A — Exportar cada buzón vía IMAP con `imapsync` (recomendado).**
`imapsync` copia mensajes de un servidor IMAP a otro sin perder nada; sirve tanto para
respaldo como para la migración en sí.

```bash
# Instalar imapsync (Linux/Mac)
# En Mac: brew install imapsync

imapsync \
  --host1 imap.secureserver.net --user1 usuario@empresa.cl --password1 'CLAVE_ORIGEN' \
  --host2 mail.bluehosting.cl   --user2 usuario@empresa.cl --password2 'CLAVE_DESTINO' \
  --ssl1 --ssl2 --automap --useheader 'Message-Id'
```

- [ ] Probar primero con `--dry` (simulación, no copia nada):
  ```bash
  imapsync ... --dry --justfolders
  ```
- [ ] Respaldo local adicional por cuenta (por si acaso): exportar a `.mbox`/`.eml`
      desde Thunderbird/Outlook, o con `offlineimap` a una carpeta local.
- [ ] Guardar el respaldo en un disco/almacenamiento externo, **no** solo en el servidor.

**Opción B — Si GoDaddy usa cPanel:** generar backup del cPanel (Home → Backup →
"Download a Full Account Backup") que incluye los correos, y restaurarlo en BlueHosting.

> 📌 Hosts IMAP típicos (confirmar en el panel real):
> - GoDaddy cPanel: `imap.secureserver.net` (SSL 993) / SMTP `smtpout.secureserver.net` (465)
> - BlueHosting: `mail.<tudominio>` o el que indique cPanel (SSL 993 / SMTP 465)

---

## 3. Migración de los mensajes (el fin de semana)

- [ ] Ejecutar `imapsync` **real** (sin `--dry`) para cada cuenta. Repetir para todas:
  ```bash
  for u in ventas contacto admin; do
    imapsync \
      --host1 imap.secureserver.net --user1 "$u@empresa.cl" --password1 "$CLAVE1" \
      --host2 mail.bluehosting.cl   --user2 "$u@empresa.cl" --password2 "$CLAVE2" \
      --ssl1 --ssl2 --automap
  done
  ```
- [ ] Guardar el **log** de cada sincronización (imapsync reporta mensajes copiados/errores).
- [ ] Verificar en el webmail de BlueHosting que las carpetas y correos llegaron completos.

---

## 4. Cambio de DNS (apuntar el correo a BlueHosting)

Este es el paso que **corta la recepción de correo** temporalmente → por eso va en fin de semana.

- [ ] En el panel DNS del dominio, actualizar los registros **MX** para que apunten a BlueHosting:
  ```
  Tipo  Nombre  Valor                       Prioridad
  MX    @       mail.empresa.cl (BlueHost)  0
  ```
- [ ] Actualizar **SPF** para incluir BlueHosting y quitar GoDaddy:
  ```
  TXT   @   "v=spf1 include:bluehosting.cl ~all"
  ```
- [ ] Configurar **DKIM/DMARC** en BlueHosting si se usaban.
- [ ] Actualizar el registro `A`/CNAME de `webmail.` y `mail.` si aplica.
- [ ] Esperar propagación (con TTL en 300s, ~5–30 min). Verificar:
  ```bash
  dig +short MX empresa.cl        # debe mostrar el MX de BlueHosting
  ```

---

## 5. Verificación post-migración

- [ ] Enviar un correo de prueba **externo → cada cuenta** y confirmar recepción en BlueHosting.
- [ ] Enviar **desde** cada cuenta hacia un correo externo (Gmail) y revisar que no caiga en spam
      (indica SPF/DKIM bien configurado).
- [ ] Confirmar que el histórico de mensajes está completo en cada buzón.
- [ ] Reconfigurar clientes (Outlook, móviles) con los nuevos servidores IMAP/SMTP de BlueHosting.
- [ ] Mantener el buzón de GoDaddy activo **1–2 semanas** como red de seguridad antes de darlo de baja.
- [ ] Subir de nuevo el TTL de los MX a su valor normal (3600s).

---

## 6. Coordinación

- [ ] Ponerse de acuerdo con **Villarai** (mencionado por Carlos) sobre accesos y ventana.
- [ ] Avisar a los usuarios: "el correo puede no recibir mensajes durante X horas el fin de semana".
- [ ] Confirmar a Carlos cuando la migración esté verificada y estable.

---

### Resumen de la ventana de fin de semana (orden de ejecución)
1. Respaldo completo verificado ✅
2. `imapsync` real de todas las cuentas ✅
3. Cambio de MX/SPF/DKIM en DNS ✅
4. Esperar propagación + pruebas de envío/recepción ✅
5. Reconfigurar clientes y avisar a Carlos ✅
