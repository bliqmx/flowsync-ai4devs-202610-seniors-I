/*
|--------------------------------------------------------------------------
| Entrypoint del documento OpenAPI versionado
|--------------------------------------------------------------------------
|
| Arranca la app AdonisJS en entorno de consola y, según el argumento, genera
| el documento OpenAPI en `docs/api/openapi.json` o comprueba que lo versionado
| siga coincidiendo con lo que produce el código.
|
| Es un entrypoint propio en vez de un comando `node ace` a propósito: en este
| stack (Node 24 + @adonisjs/ace con jsonschema@1.5.0) el validador de metadatos
| del FsLoader lanza "Invalid URL" ante CUALQUIER comando local, lo que tumba
| todo `node ace` (migraciones y tests incluidos). Se arranca igual que `ace.js`
| arranca `bin/console.ts`: registrando el hook de TypeScript y usando el
| Ignitor. Se expone por los scripts `openapi:generate` y `openapi:check`.
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

const ACTION = process.argv[2]

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })

try {
  const app = ignitor.createApp('console')
  await app.init()
  await app.boot()

  await app.start(async () => {
    // Se importa aquí, con la app ya arrancada, porque el módulo depende de los
    // servicios `app`/`router`, cuyos singletons solo están disponibles una vez
    // booteada.
    const { checkOpenapiDocument, writeOpenapiDocument } = await import('#openapi/document')

    if (ACTION === 'generate') {
      const target = await writeOpenapiDocument()
      console.log(`✔ Documento OpenAPI escrito en ${app.relativePath(target)}`)
      return
    }

    if (ACTION === 'check') {
      const result = await checkOpenapiDocument()

      if (result.versionedMissing) {
        process.exitCode = 1
        console.error(
          `✖ No existe el documento versionado en ${app.relativePath(result.versionedPath)}.`
        )
        console.error('  Ejecuta "npm run openapi:generate" para crearlo.')
        return
      }

      if (result.matches) {
        console.log(
          `✔ El documento OpenAPI versionado está al día (${app.relativePath(result.versionedPath)}).`
        )
        return
      }

      process.exitCode = 1
      console.error(
        '✖ El documento OpenAPI versionado NO coincide con el generado desde el código.'
      )
      console.error(`  Versionado: ${app.relativePath(result.versionedPath)}`)
      console.error(`  Regenerado: ${result.temporaryPath}`)

      if (result.differences.length === 0) {
        console.error(
          '  El contenido es equivalente pero el formato difiere (indentación u orden).'
        )
      } else {
        console.error('  Diferencias (versionado → generado):')
        for (const line of result.differences.slice(0, 50)) {
          console.error(`    - ${line}`)
        }
        if (result.differences.length > 50) {
          console.error(`    … y ${result.differences.length - 50} diferencia(s) más.`)
        }
      }
      console.error('  Ejecuta "npm run openapi:generate" y commitea el fichero actualizado.')
      return
    }

    process.exitCode = 1
    console.error(`Acción desconocida: ${ACTION ?? '(ninguna)'}. Usa "generate" o "check".`)
  })

  await app.terminate()
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
