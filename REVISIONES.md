# Calibración de revisiones

Instrucciones **solo para revisar código** en FlowSync. La fuente de verdad del
comportamiento es `openspec/specs/`: todo hallazgo se contrasta contra sus
scenarios y nombra el que rompe.

## 1. Qué es grave y qué no pasa de sugerencia

**Grave** (repórtalo, con el scenario que rompe):
- Desviación demostrable de un scenario de `openspec/specs/`.
- Fuga de datos de cuenta que la spec prohíbe (email o cualquier dato del
  responsable fuera de lo permitido).
- Autorización que contradice lo que la spec exige.
- Contrato roto: código HTTP distinto del que el scenario pide (p. ej. `200`
  donde toca `422`/`404`), envoltura `{ data }` rota, o campos que la spec veta.

**Sugerencia** (no sube de ahí): lo que no rompe ningún scenario — edge cases
que la spec no cubre, robustez defensiva, nombres, micro-optimización, o riesgo
de diseño no demostrado (márcalo como tal; no lo pintes de fallo).

## 2. Tope de sugerencias menores

Como mucho **5 sugerencias menores detalladas** por revisión. El resto no se
detalla: resúmelas en una línea con el conteo por categoría (p. ej. «otras 7:
3 nombres, 2 edge cases, 2 estilo»). Los hallazgos graves no tienen tope.

## 3. Dónde NO reportar

- **Lo que ya vigila otra comprobación del repo:** formato y estilo (Prettier,
  ESLint en backend, oxlint en frontend), errores de tipos (`tsc` vía
  `typecheck`/`build`), y desincronización del documento OpenAPI
  (`openapi:check` lo falla ya en CI). No dupliques su trabajo.
- **Ficheros generados:** `backend/database/schema.ts`, `backend/.adonisjs/**`,
  `docs/api/openapi.json`. No se revisan a mano.
- **Decisiones ya fijadas:** cualquier cosa que la spec o un ADR definen como
  intencional — p. ej. que cualquier cuenta autenticada pueda ver y mutar
  cualquier tarea. Contrasta contra la spec; no la discutas.
- **Fuera del cambio propuesto:** no audites el repo entero; léelo solo para
  dar contexto al diff.

## 4. Cita, no deduzcas

Para afirmar que algo se comporta de una manera, **cita `archivo:línea` donde lo
has visto**. Nada de inferir el comportamiento del nombre de una función, de una
ruta o de un comentario. Si no has abierto el código que lo demuestra, no lo
afirmes: dilo como «sin verificar» o no lo incluyas.
