import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'

/**
 * Ruta, relativa a la raíz de la app AdonisJS, del documento OpenAPI versionado.
 */
export const OPENAPI_DOCUMENT_RELATIVE_PATH = 'docs/api/openapi.json'

/**
 * Ruta absoluta del documento OpenAPI versionado.
 *
 * El documento vive en `docs/` en la raíz del monorepo, un nivel por encima de
 * la app AdonisJS (que está en `backend/`). `app.makePath` resuelve contra la
 * raíz de la app, así que subimos uno.
 */
export function openapiDocumentPath(): string {
  return app.makePath('..', OPENAPI_DOCUMENT_RELATIVE_PATH)
}

/**
 * Construye el documento OpenAPI desde el código: exactamente el mismo que se
 * sirve por HTTP en `/api.json`.
 *
 * En un proceso de consola no hay servidor HTTP que haya comprometido las rutas
 * del router; sin `commit()`, `router.toJSON()` —que el loader de OpenAPI
 * recorre— no las ve y el documento saldría sin rutas.
 */
export async function buildOpenapiDocument(): Promise<unknown> {
  if (!router.commited) {
    router.commit()
  }

  const { default: openapi } = await import('@foadonis/openapi/services/main')
  return openapi.buildDocument()
}

/**
 * Serializa el documento a la forma exacta que se versiona: JSON con dos
 * espacios de indentación y un salto de línea final. Es estable entre
 * ejecuciones y amable con los diffs de git. Generación y comprobación tienen
 * que coincidir byte a byte, así que ambas pasan por aquí.
 */
export function serializeOpenapiDocument(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * Genera el documento y lo escribe en el fichero versionado. Es lo único que
 * escribe ese fichero.
 *
 * @returns la ruta absoluta del fichero escrito.
 */
export async function writeOpenapiDocument(): Promise<string> {
  const document = await buildOpenapiDocument()
  const body = serializeOpenapiDocument(document)
  const target = openapiDocumentPath()

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body, 'utf-8')

  return target
}

export type OpenapiCheckResult = {
  /** El documento versionado coincide con el generado desde el código. */
  matches: boolean
  /** No existe el fichero versionado: no hay nada con lo que comparar. */
  versionedMissing: boolean
  /** Ruta absoluta del documento versionado. */
  versionedPath: string
  /** Ruta absoluta de la copia regenerada en una ubicación temporal. */
  temporaryPath: string | null
  /** Diferencias legibles cuando el contenido difiere. */
  differences: string[]
}

/**
 * Regenera el documento en una ubicación temporal (fuera del repositorio) y lo
 * compara con el versionado. NO toca las rutas ni reescribe el fichero
 * versionado: solo informa. Arreglar la divergencia es trabajo de
 * {@link writeOpenapiDocument}.
 */
export async function checkOpenapiDocument(): Promise<OpenapiCheckResult> {
  const versionedPath = openapiDocumentPath()

  if (!existsSync(versionedPath)) {
    return {
      matches: false,
      versionedMissing: true,
      versionedPath,
      temporaryPath: null,
      differences: [],
    }
  }

  const document = await buildOpenapiDocument()
  const regenerated = serializeOpenapiDocument(document)

  const temporaryDir = await mkdtemp(join(tmpdir(), 'flowsync-openapi-'))
  const temporaryPath = join(temporaryDir, 'openapi.json')
  await writeFile(temporaryPath, regenerated, 'utf-8')

  const versioned = await readFile(versionedPath, 'utf-8')

  if (versioned === regenerated) {
    return {
      matches: true,
      versionedMissing: false,
      versionedPath,
      temporaryPath,
      differences: [],
    }
  }

  return {
    matches: false,
    versionedMissing: false,
    versionedPath,
    temporaryPath,
    differences: diffOpenapiDocuments(JSON.parse(versioned), JSON.parse(regenerated)),
  }
}

/**
 * Lista legible de diferencias entre dos documentos ya parseados, en términos
 * de la ruta JSON de cada divergencia. Solo explica; no modifica nada.
 */
export function diffOpenapiDocuments(expected: unknown, actual: unknown): string[] {
  const differences: string[] = []
  collectDifferences('', expected, actual, differences)
  return differences
}

function collectDifferences(path: string, expected: unknown, actual: unknown, out: string[]): void {
  if (expected === actual) {
    return
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length)
    for (let index = 0; index < length; index++) {
      collectDifferences(`${path}[${index}]`, expected[index], actual[index], out)
    }
    return
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    for (const key of [...keys].sort()) {
      const childPath = path ? `${path}.${key}` : key
      collectDifferences(childPath, expected[key], actual[key], out)
    }
    return
  }

  const location = path || '(raíz)'
  if (expected === undefined) {
    out.push(`${location}: ausente en el versionado, presente en el generado (${describe(actual)})`)
  } else if (actual === undefined) {
    out.push(
      `${location}: presente en el versionado (${describe(expected)}), ausente en el generado`
    )
  } else {
    out.push(`${location}: ${describe(expected)} → ${describe(actual)}`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.length} elementos]`
  }
  if (isPlainObject(value)) {
    return '{…}'
  }
  return String(value)
}
