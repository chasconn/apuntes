# Guía de migración de correo: GoDaddy → Bluehosting

Dominio: **fluidsolutionsbc.com**
Objetivo: mover el correo de GoDaddy (Titan) a Bluehosting (cPanel) **sin perder correos** y **sin cortar el servicio**.

> ⚠️ **Regla de oro:** no cancelar ni apagar GoDaddy hasta 1–2 semanas después de confirmar que todo llegó bien a Bluehosting. El correo viejo se queda en GoDaddy como respaldo hasta entonces.

---

## 1. Estado / cuentas a migrar

| Cuenta | Volumen aprox. | Estado |
|---|---|---|
| `carlos.cg.burgos@fluidsolutionsbc.com` | ~14 GB · ~31.600 correos en Bandeja | En migración |
| `ventas@fluidsolutionsbc.com` | ~3.240 correos | Pendiente |

Almacenamiento en Bluehosting: **Ilimitado** (cuota configurada al crear las cuentas).

---

## 2. Datos de servidor (IMAP / SMTP)

### GoDaddy (Titan) — origen
| Dato | Valor |
|---|---|
| IMAP entrante | `imap.secureserver.net` · puerto **993** · SSL/TLS |
| SMTP saliente | `smtpout.secureserver.net` · puerto **465** · SSL/TLS |
| Usuario | dirección de correo completa |

### Bluehosting (cPanel) — destino
| Dato | Valor |
|---|---|
| IMAP entrante | `fluidsolutionsbc.com` · puerto **993** · SSL/TLS |
| SMTP saliente | `fluidsolutionsbc.com` · puerto **465** · SSL/TLS |
| Usuario | dirección de correo completa |
| IP del servidor | **186.64.118.5** (correo entrante) · **186.64.118.8** (salida/SPF) |

> Al configurar Thunderbird/Outlook, usar siempre **IMAP** (nunca POP), para que los correos queden en el servidor y se vean sincronizados en todos los dispositivos.

---

## 3. Proceso de migración de correos (por cada cuenta)

1. **Crear la cuenta en Bluehosting** (cPanel → Cuentas de correo → Crear), con el **mismo nombre** que en GoDaddy y **cuota Ilimitada**.
2. **Agregar ambas cuentas a Thunderbird** por IMAP:
   - La de GoDaddy (autodetecta `secureserver.net`).
   - La de Bluehosting → **"Configurar manualmente"** con servidor `fluidsolutionsbc.com` (993 / 465, SSL/TLS). No dejar autodetección (pondría GoDaddy).
3. **Descargar / respaldar**: abrir cada carpeta de la cuenta GoDaddy para que baje todo el correo al PC.
4. **Copiar carpeta por carpeta** de GoDaddy → Bluehosting:
   - Clic en la carpeta (GoDaddy) → `Ctrl+A` → clic derecho → **"Copiar a"** → cuenta Bluehosting → carpeta equivalente.
   - Copiar: **Bandeja de entrada, Enviados, Borradores, Archivar, Archivo**.
   - **NO** copiar: **Spam** ni **Papelera** (es basura).
   - Arrastrar/copiar entre cuentas distintas = **copia** (el original en GoDaddy no se borra).
5. **Verificar** que en Bluehosting aparezcan los correos en cada carpeta.

Repetir todo para `ventas@`.

---

## 4. Cambio de DNS (para que el correo NUEVO llegue a Bluehosting)

> El DNS del dominio se administra en **GoDaddy** (nameservers `ns55.domaincontrol.com` / `ns56.domaincontrol.com`). **Estos cambios se hacen SÍ o SÍ dentro de GoDaddy** (Mis productos → Dominios → fluidsolutionsbc.com → Administrar DNS). Los cambios en el Zone Editor de Bluehosting NO tienen efecto mientras los nameservers sean de GoDaddy.

### 4.1 Registro MX
**Borrar** los MX actuales de GoDaddy:
- `smtp.secureserver.net` (prioridad 0)
- `mailstore1.secureserver.net` (prioridad 10)

**Agregar** el MX de Bluehosting:
| Campo | Valor |
|---|---|
| Tipo | MX |
| Host/Nombre | `@` (raíz del dominio) |
| Destino / Apunta a | `mail.fluidsolutionsbc.com` |
| Prioridad | `0` |

### 4.2 Registro A para `mail` (necesario para que funcione el MX)
`mail.fluidsolutionsbc.com` no existe en el DNS de GoDaddy, hay que crearlo:
| Campo | Valor |
|---|---|
| Tipo | A |
| Host/Nombre | `mail` |
| Apunta a | `186.64.118.5` |

### 4.3 SPF (reemplazar el TXT actual)
- TXT actual a reemplazar: `v=spf1 include:secureserver.net -all`
- **Nuevo valor:**
```
v=spf1 +ip4:186.64.118.8 +include:secureserver.net -all
```
| Campo | Valor |
|---|---|
| Tipo | TXT |
| Host/Nombre | `@` |
| Valor | (el de arriba) |

> Este SPF autoriza a **Bluehosting y a GoDaddy** a la vez → ideal durante la transición.

### 4.4 DKIM (agregar TXT)
| Campo | Valor |
|---|---|
| Tipo | TXT |
| Host/Nombre | `default._domainkey` |
| Valor | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA…` |

> ⚠️ El valor DKIM es **muy largo**. Copiarlo COMPLETO desde:
> cPanel → **Email Deliverability** → dominio → **Administrar** → sección DKIM → botón **"Copiar"**.
> No escribirlo a mano.

### 4.5 DMARC (opcional, recomendado)
| Campo | Valor |
|---|---|
| Tipo | TXT |
| Host/Nombre | `_dmarc` |
| Valor | `v=DMARC1; p=none;` |

---

## 5. Después del cambio de DNS

1. **Propagación:** de minutos hasta 24–48 h. Hacer el cambio **fin de jornada o fin de semana**.
2. **Convivencia (1–2 semanas):** mantener GoDaddy **activo**; revisar por si llega algún correo rezagado y moverlo a Bluehosting.
3. **Prueba:** desde un Gmail/Outlook externo, enviar un correo a `carlos.cg.burgos@fluidsolutionsbc.com` y confirmar que **llega a Bluehosting**.
4. **Verificar entregabilidad:** cPanel → **Email Deliverability** debe pasar a estado **OK** (verde) una vez propagados SPF/DKIM.
5. **Recién entonces:** cancelar / no renovar el correo de GoDaddy.

---

## 6. Checklist rápido

- [ ] Cuenta `carlos@` creada en Bluehosting (cuota ilimitada)
- [ ] Cuenta `ventas@` creada en Bluehosting (cuota ilimitada)
- [ ] Correos de `carlos@` copiados y verificados en Bluehosting
- [ ] Correos de `ventas@` copiados y verificados en Bluehosting
- [ ] Acceso a GoDaddy conseguido
- [ ] MX cambiado a `mail.fluidsolutionsbc.com` (prioridad 0)
- [ ] Registro A `mail` → 186.64.118.5 creado
- [ ] SPF actualizado
- [ ] DKIM agregado
- [ ] DMARC agregado (opcional)
- [ ] Prueba de correo entrante OK en Bluehosting
- [ ] Convivencia 1–2 semanas superada
- [ ] GoDaddy dado de baja

---

## 7. Notas de seguridad

- Usar **IMAP** (no POP) en todos los clientes de correo.
- Guardar las contraseñas de Bluehosting en un lugar seguro; si alguna quedó visible en pantalla/captura, **cambiarla** desde el cPanel.
- No compartir capturas donde se vean contraseñas.
