/**
 * Detect installed library version from the project's package.json.
 * Used to auto-fill git tags when --tag is omitted in --lib mode.
 */

import fs from 'fs'
import path from 'path'

export interface DetectedVersion {
  packageName: string
  /** Clean semver without prefix: e.g., '15.0.0' */
  version: string
  /** Full git tag: e.g., 'v15.0.0'. null if tagPrefix is null. */
  gitTag: string | null
}

/**
 * Detect installed version of a library from the project's package.json.
 * Returns null if the package is not found in dependencies.
 */
export function detectVersion(
  packages: string[],
  tagPrefix: string | null
): DetectedVersion | null {
  try {
    const cwd = process.cwd()
    const packageJsonPath = path.join(cwd, 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      return null
    }

    const raw = fs.readFileSync(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(raw)

    // Merge all dependency sources. Later spreads override earlier ones,
    // so priority is: peerDependencies > devDependencies > dependencies
    const dependencies: Record<string, string> = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    }

    for (const pkgName of packages) {
      const specifier = dependencies[pkgName]
      if (!specifier || typeof specifier !== 'string') continue

      // Clean version string: strip workspace:, npm: alias, ^, ~, >= prefixes
      let version = specifier
      // Handle npm: aliases like "npm:@next/canary@15.0.0" → extract trailing version
      if (version.startsWith('npm:')) {
        const atIdx = version.lastIndexOf('@')
        if (atIdx > 4) {
          version = version.slice(atIdx + 1)
        } else {
          continue // malformed npm: alias, no version portion
        }
      }
      version = version
        .replace(/^workspace:/, '')
        .replace(/^[~^>=]+/, '')

      // Skip non-semver values like '*', 'latest', 'workspace:*'
      if (!/\d/.test(version)) continue

      if (tagPrefix === null) {
        return { packageName: pkgName, version, gitTag: null }
      }

      const gitTag = tagPrefix + version

      return { packageName: pkgName, version, gitTag }
    }
  } catch {
    // Silently fail — caller will use defaultTag as fallback
    return null
  }

  return null
}
