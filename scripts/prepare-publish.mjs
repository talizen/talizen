import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const rootDir = process.cwd()
const distDir = path.join(rootDir, "dist")

const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"))

const publishPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  type: packageJson.type,
  license: packageJson.license,
  sideEffects: packageJson.sideEffects,
  main: packageJson.main,
  types: packageJson.types,
  exports: packageJson.exports,
}

await mkdir(distDir, { recursive: true })
await writeFile(
  path.join(distDir, "package.json"),
  `${JSON.stringify(publishPackageJson, null, 2)}\n`,
)
await copyFile(path.join(rootDir, "README.md"), path.join(distDir, "README.md"))
