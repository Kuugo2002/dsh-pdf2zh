import { cp, mkdir, readFile, writeFile, access, realpath, rename } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'

// Keep the old directory as a backup, including any non-relocatable Python venv.
export async function migrateDataDirectory(previous, destination) {
  try { await access(join(destination, 'state.json')); return } catch (error) { if (error.code !== 'ENOENT') throw error }
  let saved
  try { saved = JSON.parse(await readFile(join(previous, 'state.json'), 'utf8')) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  const roots = [previous, await realpath(previous)]
  const rebase = value => {
    if (typeof value === 'string' && isAbsolute(value)) for (const root of roots) {
      const suffix = relative(root, value)
      if (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('../') && !suffix.startsWith('..\\')) return join(destination, suffix)
    }
    if (Array.isArray(value)) return value.map(rebase)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebase(item)]))
    return value
  }
  await mkdir(destination, { recursive: true })
  for (const name of ['files', 'jobs']) {
    try { await cp(join(previous, name), join(destination, name), { recursive: true, force: false, errorOnExist: false }) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  // Existing interpreter paths remain valid; future managed installs use the new directory.
  try {
    const settings = await readFile(join(previous, 'environment', 'settings.json'))
    await mkdir(join(destination, 'environment'), { recursive: true })
    try { await writeFile(join(destination, 'environment', 'settings.json'), settings, { flag: 'wx', mode: 0o600 }) }
    catch (error) { if (error.code !== 'EEXIST') throw error }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await writeFile(join(destination, 'migration-state.tmp'), JSON.stringify(rebase(saved)), { mode: 0o600 })
  await rename(join(destination, 'migration-state.tmp'), join(destination, 'state.json'))
}
