import { lstat, realpath, readdir, rm } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute, sep } from 'node:path'

// Delete only immediate children of the two owned data directories.
export async function cleanupHistory({ stateDir, jobs, remainingJobs, files, glossaryIds = [], all = false }) {
  const roots = { files: resolve(stateDir, 'files'), jobs: resolve(stateDir, 'jobs') }
  const childName = (root, path) => {
    const suffix = relative(root, resolve(path))
    return suffix && !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + sep) ? suffix.split(sep)[0] : null
  }
  const keptIds = new Set(glossaryIds)
  for (const job of remainingJobs) {
    for (const file of [...job.inputs, ...job.files]) keptIds.add(file.id)
    for (const id of job.values.glossaryIds || []) keptIds.add(id)
  }
  const candidates = new Set()
  for (const job of jobs) {
    for (const file of [...job.inputs, ...job.files]) candidates.add(file.id)
    for (const id of job.values.glossaryIds || []) candidates.add(id)
  }
  const protectedNames = { files: new Set(), jobs: new Set(remainingJobs.map(job => job.id)) }
  const deleteNames = { files: new Set(), jobs: new Set() }
  for (const job of jobs) {
    if (!/^[a-f0-9-]+$/.test(job.id)) throw new Error('任务目录无效，拒绝删除。')
    deleteNames.jobs.add(job.id)
  }
  const removedFileIds = []
  for (const file of files) {
    for (const [kind, root] of Object.entries(roots)) {
      const name = childName(root, file.path)
      if (!name) continue
      if (keptIds.has(file.id)) protectedNames[kind].add(name)
      else if (all || candidates.has(file.id) || (kind === 'jobs' && deleteNames.jobs.has(name))) {
        deleteNames[kind].add(name)
        removedFileIds.push(file.id)
      }
    }
  }
  // Resolve and validate both roots before deleting anything. Never traverse a
  // replaced directory/junction into an unrelated location.
  const parent = await realpath(stateDir)
  for (const [kind, root] of Object.entries(roots)) {
    try {
      if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== join(parent, kind)) throw new Error('数据目录是链接，拒绝清理，请检查目录设置。')
      if (all) for (const name of await readdir(root)) deleteNames[kind].add(name)
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  for (const [kind, root] of Object.entries(roots)) {
    for (const name of deleteNames[kind]) {
      if (protectedNames[kind].has(name)) continue
      const target = resolve(root, name)
      if (relative(root, target) !== name || name === '..' || name.includes(sep) || target === root) throw new Error('文件删除路径无效。')
      // rm unlinks a child symlink itself rather than following it.
      await rm(target, { recursive: true, force: true })
    }
  }
  return [...new Set(removedFileIds)]
}
