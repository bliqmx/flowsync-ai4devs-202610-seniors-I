# Revisor de código en CI

Workflow: [`.github/workflows/revisor.yml`](../.github/workflows/revisor.yml).

En cada pull request (`opened`, `synchronize`) lanza la acción oficial
[`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action)
como revisor de código. Lee el repositorio (checkout + `Read`/`Grep`/`Glob`) y
publica los hallazgos **como comentarios en el pull request** —resumen con
`gh pr comment` y notas de línea con el comentario inline—, no solo en el log.
Permisos mínimos (`contents: read`, `pull-requests: write`) y techo de 10
minutos. No escribe en el código, no crea ramas ni commits, y no abre otros PRs.

---

## Pasos manuales pendientes

Sin esto, el workflow aparece en Actions pero **falla en el primer intento de
autenticación**:

1. **Crear el secreto del repositorio con la credencial.** Elige uno de los dos
   caminos de abajo y guarda el secreto en
   **Settings → Secrets and variables → Actions → New repository secret**. El
   workflow referencia `secrets.CLAUDE_CODE_OAUTH_TOKEN` (camino de
   suscripción); si usas la clave de API, cambia también la línea del input (ver
   abajo).
2. **Nada más es imprescindible.** Los comentarios se publican con el
   `GITHUB_TOKEN` por defecto gracias a `pull-requests: write`; **no** hace falta
   instalar la GitHub App de Claude para este montaje basado en secreto. (Si
   prefieres instalarla, `/install-github-app` desde Claude Code en local la
   configura, pero ese atajo solo admite la clave de API directa.)

---

## En qué se va el dinero

- **Qué modelo usa.** `--model sonnet` con `--effort medium`, acotado por
  `--max-turns 40` y `timeout-minutes: 10`. Esos dos techos son el freno de
  gasto: ni más de 40 turnos ni más de 10 minutos por revisión.
- **Por qué ese.** Sonnet es el equilibrio coste/calidad: bastante más barato
  que Opus y suficiente para una revisión de diffs; `effort medium` evita pagar
  el razonamiento extendido que una revisión rutinaria no necesita.
- **Cómo cambiarlo.** Edita `claude_args` en el workflow:
  - Modelo: `--model opus` (más capaz y más caro) o `--model haiku` (más barato,
    menos profundo).
  - Esfuerzo: `--effort low|medium|high`.
  - Techo de trabajo: sube o baja `--max-turns` y `timeout-minutes`.
- **Precio.** Las tarifas cambian; no las copio aquí para que no envejezcan sin
  que nadie se entere. Consulta la página oficial:
  **<https://www.anthropic.com/pricing>** (pestaña de API, por token).
  - Con el **token de suscripción**, el consumo va contra tu plan de Claude
    (Pro/Max), no como factura por token de la API.
  - Con la **clave de API**, se factura por token según esa página.

---

## La credencial: dos caminos (no intercambiables)

El revisor recibe su credencial de un **secreto del repositorio**. Hay dos
formas, y **cada una usa un input distinto de la acción y un nombre de secreto
distinto**. Cruzarlos (meter la clave de API en el input del token, o al revés)
**falla en la primera llamada con un error de autenticación opaco**, sin pista
de que el problema es que la credencial no corresponde al input.

### 1) Suscripción — token de `claude setup-token` (recomendado)

- En local, con una suscripción de Claude (Pro/Max) activa, ejecuta:
  ```bash
  claude setup-token
  ```
  Genera un token OAuth de larga duración.
- Input de la acción: **`claude_code_oauth_token`**.
- Nombre del secreto: **`CLAUDE_CODE_OAUTH_TOKEN`**.
- Es lo que el workflow usa tal cual viene.

### 2) Clave de API de la consola

- Crea una clave en la consola: <https://console.anthropic.com> → **API Keys**.
- Input de la acción: **`anthropic_api_key`**.
- Nombre del secreto: **`ANTHROPIC_API_KEY`**.
- Para usar este camino, en `.github/workflows/revisor.yml` sustituye la línea
  del token por:
  ```yaml
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
  ```

> No mezcles: `claude_code_oauth_token` espera el token de `setup-token` y
> `anthropic_api_key` espera la clave `sk-ant-...` de la consola. Ponerle a uno
> el valor del otro revienta en la primera petición sin explicar por qué.

---

## Cambios propuestos desde un fork (repositorio público)

En un PR abierto desde un **fork de un repositorio público**, GitHub **no
expone los secretos del repositorio** al workflow disparado por `pull_request`,
y además la acción **no arranca** para autores sin permiso de escritura. El
efecto práctico: en esos PRs el revisor **no se ejecuta** (y, de intentarlo, no
podría autenticarse al faltar el secreto). Es intencional: evita filtrar la
credencial a código no confiable.

Para revisar una aportación externa, un mantenedor con permiso de escritura
tiene que traer el cambio a una rama del propio repositorio (desde donde el
workflow sí ve el secreto) y dejar que la revisión corra allí.
