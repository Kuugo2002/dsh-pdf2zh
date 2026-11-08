import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync, inflateRawSync } from 'node:zlib'
import { mkdir, readFile, writeFile, rename, chmod, access, realpath, lstat, rm } from 'node:fs/promises'
import { join, isAbsolute, basename, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const UV_VERSION = '0.12.19'
export const DEFAULT_INDEX = 'https://pypi.tuna.tsinghua.edu.cn/simple'
const release = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/`
const assets = {
  'win32-x64': ['x86_64-pc-windows-msvc.zip', '6dbb02d79e419522f1c500f0adb1cddcff0cda7d59b0d66ea7f5e3b4a1b2f5f0'],
  'win32-arm64': ['aarch64-pc-windows-msvc.zip', '115b54cb823bc48260670f5782001add6067ac8d98d18c8263a833704e287de9'],
  'darwin-x64': ['x86_64-apple-darwin.tar.gz', 'cb5fa57bafe68fc0fb94b17f06bee0b0b9a7feb94ccbd110445afa0696e39273'],
  'darwin-arm64': ['aarch64-apple-darwin.tar.gz', 'a9a8df1eedeb192f2e47e40e2faabfb387db4b850209118786d42f89dde3e0ba'],
  'linux-x64': ['x86_64-unknown-linux-gnu.tar.gz', '23bf5552d220e0842b65c862097b2ebaeba0064b74eda5e565e77fd25969d8c8'],
  'linux-arm64': ['aarch64-unknown-linux-gnu.tar.gz', '0804e9b164c64b6914182d5920c08551958a095986f10a3731056df701126436'],
  'linux-x64-musl': ['x86_64-unknown-linux-musl.tar.gz', 'db7278c9f57981338fddff1fb250e11964bc0a4fafcb9eed8303fdb117dc067b'],
  'linux-arm64-musl': ['aarch64-unknown-linux-musl.tar.gz', 'ad8d8448a2ff642ba62c2f684d7dd22a03f8eb3fc9918c2c3e8ec975f4ed6710'],
}
export function platformAsset(platform = process.platform, arch = process.arch, musl = false) {
  const spec = assets[`${platform}-${arch}${platform === 'linux' && musl ? '-musl' : ''}`]
  return spec ? { name: 'uv-' + spec[0], url: release + 'uv-' + spec[0], sha256: spec[1], executable: platform === 'win32' ? 'uv.exe' : 'uv' } : null
}

// Extract only the verified uv executable, never arbitrary archive paths.
export function extractExecutable(bytes, asset) {
  if (asset.name.endsWith('.zip')) {
    let eocd = bytes.length - 22
    while (eocd >= Math.max(0, bytes.length - 65558) && bytes.readUInt32LE(eocd) !== 0x06054b50) eocd--
    if (eocd < 0 || bytes.readUInt32LE(eocd) !== 0x06054b50) throw new Error('无效的安装包 ZIP')
    let offset = bytes.readUInt32LE(eocd + 16)
    const count = bytes.readUInt16LE(eocd + 10)
    for (let index = 0; index < count; index++) {
      if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('无效的 ZIP 目录')
      const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20), unpacked = bytes.readUInt32LE(offset + 24)
      const nameSize = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32)
      const name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString()
      if (basename(name) === asset.executable) {
        const local = bytes.readUInt32LE(offset + 42)
        if (unpacked > 128 * 1024 * 1024 || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('无效的可执行文件')
        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
        const content = bytes.subarray(start, start + size)
        const output = method === 0 ? content : method === 8 ? inflateRawSync(content, { maxOutputLength: 128 * 1024 * 1024 }) : null
        if (!output || output.length !== unpacked) throw new Error('安装包解压失败')
        return output
      }
      offset += 46 + nameSize + extra + comment
    }
  } else {
    const tar = gunzipSync(bytes, { maxOutputLength: 160 * 1024 * 1024 })
    for (let offset = 0; offset + 512 <= tar.length;) {
      const name = tar.subarray(offset, offset + 100).toString().split('\0')[0]
      if (!name) break
      const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0/g, '').trim(), 8) || 0
      if (basename(name) === asset.executable && tar[offset + 156] === 48) return tar.subarray(offset + 512, offset + 512 + size)
      offset += 512 + Math.ceil(size / 512) * 512
    }
  }
  throw new Error('安装包中没有找到 uv')
}

export function validateEnvironmentConfig(raw) {
  if (!['managed', 'custom'].includes(raw.mode)) throw new Error('请选择自动环境或自定义环境')
  const customPath = String(raw.customPath || '').trim()
  if (raw.mode === 'custom' && (!isAbsolute(customPath) || /[\0\r\n]/.test(customPath))) throw new Error('请填写 Python 解释器的绝对路径')
  const indexUrl = String(raw.indexUrl || DEFAULT_INDEX).trim()
  const url = new URL(indexUrl)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('依赖下载地址必须是无密码的 HTTPS 地址')
  return { mode: raw.mode, customPath, indexUrl }
}

export async function resetManagedVenv(directory) {
  const parent = await realpath(directory)
  const target = resolve(parent, 'venvs')
  if (relative(parent, target) !== 'venvs') throw new Error('环境删除路径无效')
  try {
    const entry = await lstat(target)
    if (entry.isSymbolicLink() || await realpath(target) !== target) throw new Error('环境目录是链接，拒绝删除，请检查目录设置。')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await rm(target, { recursive: true, force: true })
  return join(directory, 'venvs')
}

export function createEnvironmentManager({ stateDir, source, legacyPython = '', stopProcess, onChange = () => {}, onActivated = () => {}, onInvalidated = () => {} }) {
  const directory = join(stateDir, 'environment'), settingsFile = join(directory, 'settings.json')
  const probeFile = fileURLToPath(new URL('../python/environment_probe.py', import.meta.url))
  const requirements = fileURLToPath(new URL('../python/requirements.txt', import.meta.url))
  const platform = process.platform, arch = process.arch
  const musl = platform === 'linux' && Boolean(process.report) && !process.report.getReport().header.glibcVersionRuntime
  const asset = platformAsset(platform, arch, musl)
  let config = { mode: legacyPython ? 'custom' : 'managed', customPath: legacyPython, indexUrl: DEFAULT_INDEX, managedPython: '', defaultsVersion: 1 }
  let health = null, operation = { phase: 'idle', progress: 0, stage: '', logs: '' }, running, controller, child, closed = false
  const effectivePython = () => config.mode === 'custom' ? config.customPath : config.managedPython
  const status = () => ({ config: { ...config }, python: effectivePython(), health, operation: { ...operation }, busy: Boolean(running),
    system: { platform, arch, supported: Boolean(asset), label: ({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' })[platform] + ' · ' + arch },
    directory, pythonVersion: '3.13' })
  const update = changes => { operation = { ...operation, ...changes }; onChange() }
  const log = chunk => { operation.logs = (operation.logs + chunk.toString()).slice(-20000); onChange() }
  const environment = () => {
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (['PYTHONHOME', 'PYTHONPATH', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'UV_PYTHON', 'UV_PYTHON_DOWNLOADS'].includes(key.toUpperCase())) delete env[key]
    return { ...env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1', UV_PYTHON_INSTALL_DIR: join(directory, 'python'),
      UV_PYTHON_BIN_DIR: join(directory, 'python-bin'), UV_CACHE_DIR: join(directory, 'cache'), UV_NO_MODIFY_PATH: '1', UV_HTTP_TIMEOUT: '120' }
  }
  const command = (executable, args, { signal, timeoutMs = 900000, capture = false } = {}) => new Promise((resolve, reject) => {
    const processChild = spawn(executable, args, { cwd: stateDir, env: environment(), windowsHide: true, detached: platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    child = processChild
    let stdout = '', stderr = '', timedOut = false
    const abort = () => { void stopProcess(processChild) }
    const timer = setTimeout(() => { timedOut = true; abort() }, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    processChild.stdout.on('data', c => { stdout = (stdout + c).slice(-200000); if (!capture) log(c) })
    processChild.stderr.on('data', c => { stderr = (stderr + c).slice(-20000); if (!capture) log(c) })
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); if (child === processChild) child = undefined }
    processChild.once('error', error => { clean(); reject(error) })
    processChild.once('close', code => {
      clean()
      if (signal?.aborted) reject(new Error('安装已取消'))
      else if (timedOut) reject(new Error('环境操作超时，请检查网络后重试。'))
      else if (code !== 0) reject(new Error(stderr || stdout || `进程退出 (${code})`))
      else resolve(stdout)
    })
  })
  async function check(python = effectivePython(), { signal } = {}) {
    if (!python) return { ok: false, python: '', issues: ['尚未安装 Python，请点击一键安装，或设置自定义路径。'], packages: {} }
    try { return JSON.parse(await command(python, [probeFile, source], { signal, capture: true, timeoutMs: 60000 })) }
    catch (error) { return { ok: false, python, issues: [error.code === 'ENOENT' ? '找不到 Python 解释器，请检查路径或使用一键安装。' : error.message], packages: {} } }
  }
  async function save(next) {
    const temp = settingsFile + '.tmp'
    await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 }); await rename(temp, settingsFile); config = next
  }
  async function init() {
    await mkdir(directory, { recursive: true })
    try {
      const saved = JSON.parse(await readFile(settingsFile, 'utf8'))
      config = { ...config, ...saved }
      if (!saved.defaultsVersion) {
        if (!saved.indexUrl || saved.indexUrl === 'https://pypi.org/simple') config.indexUrl = DEFAULT_INDEX
        await save({ ...config, defaultsVersion: 1 })
      }
    } catch (error) { if (error.code !== 'ENOENT') log('环境配置读取失败：' + error.message + '\n') }
    health = await check(); onChange(); return status()
  }
  async function apply(raw) {
    if (running) throw new Error('正在安装环境，请稍候或取消。')
    const next = { ...config, ...validateEnvironmentConfig(raw) }
    const result = await check(next.mode === 'custom' ? next.customPath : next.managedPython)
    if (!result.ok) { onChange(); throw new Error(result.issues.join('\n')) }
    await save(next); health = result; onActivated(effectivePython(), result); onChange(); return status()
  }
  async function bootstrap(signal) {
    if (!asset) throw new Error('此系统暂不支持自动安装，请使用自定义 Python 环境。')
    const uvPath = join(directory, 'bin', UV_VERSION, asset.executable)
    try { await access(uvPath); await command(uvPath, ['--version'], { signal, capture: true, timeoutMs: 10000 }); return uvPath } catch (error) { if (signal.aborted) throw error }
    update({ phase: 'downloading', progress: .05, stage: '下载环境安装工具' })
    const response = await fetch(asset.url, { signal })
    if (!response.ok) throw new Error(`安装工具下载失败 (${response.status})，请检查 GitHub 网络连接后重试。`)
    const chunks = []; let size = 0
    const total = Number(response.headers.get('content-length'))
    for await (const chunk of response.body) {
      size += chunk.length; if (size > 80 * 1024 * 1024) throw new Error('安装工具文件过大')
      chunks.push(chunk); update({ progress: total ? .05 + .15 * size / total : .1 })
    }
    const archive = Buffer.concat(chunks)
    if (createHash('sha256').update(archive).digest('hex') !== asset.sha256) throw new Error('下载文件校验失败，请重试。')
    const executable = extractExecutable(archive, asset)
    await mkdir(join(directory, 'bin', UV_VERSION), { recursive: true })
    await writeFile(uvPath + '.tmp', executable, { mode: 0o755 }); await rename(uvPath + '.tmp', uvPath)
    if (platform !== 'win32') await chmod(uvPath, 0o755)
    return uvPath
  }
  function install(raw = {}) {
    if (closed) throw new Error('插件已关闭')
    if (running) throw new Error('环境安装已经在进行中')
    const next = { ...config, ...validateEnvironmentConfig({ ...config, ...raw }) }
    controller = new AbortController()
    const { signal } = controller
    operation = { phase: 'starting', progress: 0, stage: '准备环境', logs: '', error: null }
    running = (async () => {
      try {
        const uv = await bootstrap(signal)
        let python = next.customPath
        if (next.mode === 'managed') {
          update({ phase: 'removing', progress: .2, stage: '删除旧虚拟环境' })
          if (signal.aborted) throw new Error('安装已取消')
          const venv = join(directory, 'venvs')
          const current = effectivePython(), suffix = current ? relative(venv, current) : '..'
          const invalidated = config.mode === 'managed' || (current && !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + (platform === 'win32' ? '\\' : '/')))
          await save({ ...config, managedPython: '', ...(invalidated && config.mode === 'custom' ? { customPath: '' } : {}) })
          if (invalidated) { health = null; onInvalidated() }
          await resetManagedVenv(directory)
          if (signal.aborted) throw new Error('安装已取消')
          update({ phase: 'python', progress: .25, stage: '下载并安装 Python 3.13' })
          await command(uv, ['python', 'install', '3.13', '--no-bin', ...(platform === 'win32' ? ['--no-registry'] : []), '--no-config', '--no-progress'], { signal })
          await command(uv, ['venv', venv, '--python', '3.13', '--managed-python', '--seed', '--no-config', '--no-progress'], { signal })
          python = platform === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')
          next.managedPython = python
        } else {
          const preliminary = await check(python, { signal })
          if (!preliminary.compatible) throw new Error(preliminary.issues.join('\n'))
        }
        update({ phase: 'dependencies', progress: .5, stage: '安装 PDF 翻译依赖' })
        await command(uv, ['pip', 'install', '--python', python, '-r', requirements, '--default-index', next.indexUrl, '--no-config', '--no-progress'], { signal })
        update({ phase: 'checking', progress: .9, stage: '检查环境和 PDF 引擎' })
        const result = await check(python, { signal })
        if (signal.aborted) throw new Error('安装已取消')
        if (!result.ok) throw new Error(result.issues.join('\n'))
        await save(next); health = result; onActivated(python, result)
        update({ phase: 'completed', progress: 1, stage: '环境已安装并启用' })
      } catch (error) {
        log(error.message + '\n')
        update({ phase: signal.aborted ? 'cancelled' : 'failed', error: signal.aborted ? null : error.message, stage: signal.aborted ? '安装已取消' : '安装失败，可重试' })
      } finally { running = undefined; onChange() }
    })()
    onChange(); return status()
  }
  async function cancel() { controller?.abort(); if (child) await stopProcess(child); await running; return status() }
  async function close() { closed = true; await cancel() }
  return { init, status, check, apply, install, cancel, close, effectivePython, wait: () => running }
}
