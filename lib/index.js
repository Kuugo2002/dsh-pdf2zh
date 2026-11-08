import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, rename, stat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGateway, listCatalog, splitModelId, sendJson } from './gateway.js'
import { fields, defaults, normalize, buildSettings } from './schema.js'
import { createEnvironmentManager } from './environment.js'
import { migrateDataDirectory } from './data-directory.js'

export const name = 'pdfzh'
export const inject = ['llm', 'webServer', 'connection']
export const PREFIX = '/api/pdfzh'
const worker = fileURLToPath(new URL('../python/worker.py', import.meta.url))
export const bundledSource = fileURLToPath(new URL('../vendor/PDFMathTranslate-next/', import.meta.url))
const localeData = JSON.parse(await readFile(new URL('./locales.json', import.meta.url), 'utf8'))
const MAX_UPLOAD = 200 * 1024 * 1024
const inside = (root, path) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(rel) }
const safeName = name => basename(String(name).replaceAll('\\', '/')).replace(/[<>:"|?*\x00-\x1f]/g, '_').slice(-180) || 'document.pdf'
export const pdfDownloadName = name => name.replace(/[._-]*(?:no[._-]?)?watermark(?:ed)?[._-]*/gi, '.').replace(/\.{2,}/g, '.').replace(/^[ ._-]+/, '') || 'translated.pdf'
const fail = (message, status = 400) => Object.assign(new Error(message), { status })

export function errorSummary(message) {
  if (!message) return message
  const text = String(message).trim()
  return text.length > 350 || /(?:WARNING:|Traceback \(most recent call last\)|\n.*(?:WARNING|ERROR):)/.test(text)
    ? '翻译未完成，请展开“查看日志”查看详情。' : text
}
const logDetails = (...messages) => [...new Set(messages.filter(Boolean).map(s => String(s).trim()))].join('\n\n')

export function resolveConfig(config = {}, env = process.env) {
  const str = (v, fallback) => typeof v === 'string' && v.trim() ? v.trim() : fallback
  return {
    python: str(config.python, env.PDFZH_PYTHON || ''),
    source: str(config.source, env.PDFZH_SOURCE || bundledSource),
    stateDir: resolve(str(config.stateDir, join(env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-pdf2zh'))),
    legacyStateDir: config.stateDir ? null : resolve(join(env.DSH_HOME || join(homedir(), '.dsh'), 'pdfzh-native')),
    timeoutMs: config.timeoutMs || 3600000,
  }
}

async function body(req, limit = 1024 * 1024) {
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw fail('File is too large', 413); chunks.push(chunk) }
  return Buffer.concat(chunks)
}
async function json(req) {
  try { return JSON.parse((await body(req)).toString('utf8')) } catch (err) { throw fail(err.status ? err.message : 'Invalid JSON', err.status || 400) }
}

export async function killTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    await new Promise(resolve => { killer.once('error', () => { child.kill(); resolve() }); killer.once('close', resolve) })
  } else { try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') } }
  await exited
}

export function createRuntime(ctx, config) {
  const options = resolveConfig(config)
  const fileMap = new Map(), jobMap = new Map(), subscribers = new Set(), children = new Set()
  const controllers = new Set()
  let phase = 'stopped', error = null, preferences = { ...defaults, glossaryIds: [] }, starting, disposed = false, active = null
  let saveChain = Promise.resolve()
  const env = { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' }
  if (options.source) env.PYTHONPATH = options.source + (env.PYTHONPATH ? (process.platform === 'win32' ? ';' : ':') + env.PYTHONPATH : '')
  const spawnPython = args => {
    if (args[0] === worker) args = [...args, '--source', options.source]
    const child = spawn(options.python, args, { cwd: options.stateDir, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    children.add(child); child.once('close', () => children.delete(child)); return child
  }
  const python = (args, max = 16 * 1024 * 1024) => new Promise((resolve, reject) => {
    const child = spawnPython(args), chunks = []; let size = 0, stderr = ''
    const timer = setTimeout(() => { void killTree(child); reject(fail('PDF inspection timed out', 504)) }, 60000)
    child.stdout.on('data', chunk => { size += chunk.length; if (size > max) { void killTree(child); reject(fail('Worker response is too large')) } else chunks.push(chunk) })
    child.stderr.on('data', c => { stderr = (stderr + c).slice(-4000) })
    child.once('error', err => { clearTimeout(timer); reject(err) })
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve(Buffer.concat(chunks)) : reject(fail(stderr || Buffer.concat(chunks).toString() || `Python exited (${code})`)) })
  })
  const fileView = f => ({ id: f.id, name: ['mono', 'dual'].includes(f.kind) ? pdfDownloadName(f.name) : f.name, size: f.size, kind: f.kind, inputName: f.inputName, url: `${PREFIX}/files/${f.id}/download` })
  const jobView = job => ({ id: job.id, status: job.status, progress: job.progress, stage: job.stage, currentFile: job.currentFile,
    index: job.index, total: job.inputs.length, stageCurrent: job.stageCurrent, stageTotal: job.stageTotal, part: job.part, parts: job.parts,
    createdAt: job.createdAt, finishedAt: job.finishedAt, model: job.values.model,
    inputs: job.inputs.map(fileView), files: job.files.map(fileView), failures: job.failures.map(f => ({ ...f, error: errorSummary(f.error) })),
    usage: Object.fromEntries(Object.entries(job.usage || {}).filter(([key]) => ['total', 'prompt', 'completion'].includes(key))), error: errorSummary(job.error),
    logs: logDetails(job.logs, errorSummary(job.error) !== job.error ? job.error : null,
      ...job.failures.filter(f => errorSummary(f.error) !== f.error).map(f => f.error)) || undefined })
  const status = () => ({ phase, error, jobs: [...jobMap.values()].map(jobView).reverse(), environment: environmentManager.status() })
  const broadcast = () => {
    const data = `event: status\ndata: ${JSON.stringify(status())}\n\n`
    for (const res of subscribers) { if (res.writableLength > 1024 * 1024) { res.destroy(); subscribers.delete(res) } else res.write(data) }
  }
  const environmentManager = createEnvironmentManager({ stateDir: options.stateDir, source: options.source, legacyPython: options.python,
    stopProcess: killTree, onChange: broadcast, onInvalidated: () => { options.python = ''; phase = 'needs_environment'; error = null; broadcast() },
    onActivated: python => { options.python = python; phase = 'ready'; error = null; broadcast() } })
  const persist = () => {
    const snapshot = JSON.stringify({ preferencesVersion: 2, preferences, files: [...fileMap.values()], jobs: [...jobMap.values()].map(j => ({ ...jobView(j), values: j.values })) })
    saveChain = saveChain.catch(() => {}).then(async () => {
      const temp = join(options.stateDir, 'state.tmp.json')
      await writeFile(temp, snapshot, { mode: 0o600 }); await rename(temp, join(options.stateDir, 'state.json'))
    })
    return saveChain
  }
  async function start() {
    if (disposed) throw fail('Plugin is closed', 503)
    if (starting) return starting
    if (phase === 'ready') return
    starting = (async () => {
      phase = 'starting'; error = null
      try {
        if (options.legacyStateDir) await migrateDataDirectory(options.legacyStateDir, options.stateDir)
        await mkdir(join(options.stateDir, 'files'), { recursive: true })
        try {
          const saved = JSON.parse(await readFile(join(options.stateDir, 'state.json'), 'utf8'))
          preferences = normalize(saved.preferencesVersion >= 2 ? saved.preferences : {
            ...saved.preferences, watermark_output_mode: 'no_watermark', rateMode: 'Concurrent Threads', threads: 8,
            termRateMode: 'Concurrent Threads', termThreads: 8,
          })
          for (const f of saved.files || []) if (inside(options.stateDir, f.path)) fileMap.set(f.id, f)
          for (const j of saved.jobs || []) {
            const job = { ...j, inputs: j.inputs.map(f => fileMap.get(f.id)).filter(Boolean), files: j.files.map(f => fileMap.get(f.id)).filter(Boolean) }
            if (['running', 'queued', 'cancelling'].includes(job.status)) { job.status = 'failed'; job.error = 'Translation interrupted by a previous shutdown' }
            jobMap.set(job.id, job)
          }
        } catch (err) { if (err.code !== 'ENOENT') ctx.logger?.warn?.(`pdfzh: could not load preferences: ${err.message}`) }
        const environmentState = await environmentManager.init()
        options.python = environmentState.python
        if (!environmentState.health.ok) {
          phase = 'needs_environment'; error = null; await persist(); broadcast(); return
        }
        // Older workers sometimes returned paths that did not match the actual
        // final output names. Recover verified PDFs before interpreting a legacy failure.
        for (const job of jobMap.values()) {
          if (job.status === 'failed' && !job.failures.length && /WARNING:/.test(job.logs || '') &&
              !/(?:ERROR:|CRITICAL:|Traceback \(most recent call last\))/.test(job.logs || '') &&
              (job.error === '翻译未完成，请展开“查看日志”查看详情。' || /^WARNING:/.test(job.error || ''))) {
            await recoverOutputs(job)
            if (hasExpectedOutputs(job)) { job.status = 'completed'; job.error = undefined; job.progress = 1; job.stage = 'Translation complete!' }
          }
        }
        if (!disposed) { phase = 'ready'; await persist() }
      } catch (err) { phase = 'failed'; error = err.message }
      broadcast()
    })().finally(() => { starting = undefined })
    return starting
  }
  async function registerFile(path, name, kind, inputName) {
    const f = { id: randomUUID(), path: resolve(path), name: safeName(name), kind, inputName, size: (await stat(path)).size }
    fileMap.set(f.id, f); return f
  }
  const hasExpectedOutputs = job => job.inputs.every((input, index) => ['mono', 'dual'].every(kind =>
    job.values[kind === 'mono' ? 'no_mono' : 'no_dual'] || job.files.some(f => f.kind === kind && inside(join(options.stateDir, 'jobs', job.id, String(index + 1)), f.path))))
  async function recoverOutputs(job) {
    for (const [index, input] of job.inputs.entries()) {
      const directory = join(options.stateDir, 'jobs', job.id, String(index + 1))
      let names
      try { names = await readdir(directory) } catch { continue }
      for (const kind of ['mono', 'dual']) {
        if (job.values[kind === 'mono' ? 'no_mono' : 'no_dual']) continue
        if (job.files.some(f => f.kind === kind && inside(directory, f.path))) continue
        const candidates = names.filter(name => name.toLowerCase().endsWith(`.${kind}.pdf`))
          .sort((a, b) => Number(/no[._-]?watermark/i.test(b)) - Number(/no[._-]?watermark/i.test(a)))
        for (const name of candidates) {
          const path = join(directory, name)
          try {
            const info = JSON.parse((await python([worker, 'inspect', path])).toString())
            if (info.pages < 1) continue
            job.files.push(await registerFile(path, pdfDownloadName(name), kind, input.name)); break
          } catch { /* An unreadable or incomplete PDF is not a successful output. */ }
        }
      }
    }
  }
  async function upload(bytes, name) {
    name = safeName(name)
    const pdf = name.toLowerCase().endsWith('.pdf'), csv = name.toLowerCase().endsWith('.csv')
    if (!pdf && !csv) throw fail('Only PDF and CSV files are supported')
    if (pdf && !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw fail('Invalid PDF file')
    if (csv && bytes.length > 10 * 1024 * 1024) throw fail('Glossary exceeds 10 MB', 413)
    const dir = join(options.stateDir, 'files', randomUUID()); await mkdir(dir)
    const path = join(dir, name); await writeFile(path, bytes)
    const metadata = JSON.parse((await python([worker, pdf ? 'inspect' : 'glossary', path])).toString())
    const f = await registerFile(path, name, pdf ? 'input' : 'glossary-input')
    await persist(); return { ...fileView(f), ...metadata }
  }
  const getFile = id => { const f = fileMap.get(id); if (!f) throw fail('File not found', 404); return f }
  const getJob = id => { const job = jobMap.get(id); if (!job) throw fail('Job not found', 404); return job }
  async function runJob(job) {
    active = job; job.status = 'running'; job.stage = 'Preparing'; broadcast()
    let gateway, child, timedOut = false, processing = Promise.resolve(), processingError, stderr = ''
    const token = randomBytes(32).toString('hex')
    try {
      const values = job.values
      const target = id => splitModelId(id, ctx.llm.listProviders().map(p => p.id))
      const llm = {
        listProviders: () => [{ id: 'main' }, { id: 'term' }], listModels: async () => [{ id: 'selected' }],
        stream: request => {
          const route = target(request.provider === 'term' ? values.termModel || values.model : values.model)
          if (!route) throw fail('Selected model provider is no longer available')
          const forwarded = { ...request, ...route }
          if (values.prompt && request.provider === 'main') {
            const prompt = values.prompt.replace(/\$\{?lang_in\}?/g, values.lang_in).replace(/\$\{?lang_out\}?/g, values.lang_out)
            forwarded.system = [request.system, prompt].filter(Boolean).join('\n\n')
          }
          return ctx.llm.stream(forwarded)
        },
      }
      gateway = createGateway({ llm, token, retries: 3, timeoutMs: Math.max(values.timeout, values.termTimeout) * 1000 })
      const address = await gateway.listen()
      const output = join(options.stateDir, 'jobs', job.id); await mkdir(output, { recursive: true })
      const settings = buildSettings(values, { ...address, token, output, glossaryPaths: values.glossaryIds.map(id => getFile(id).path) })
      const manifest = join(output, 'request.json')
      await writeFile(manifest, JSON.stringify({ settings, output, inputs: job.inputs.map(f => ({ path: f.path, name: f.name })) }), { mode: 0o600 })
      if (job.status === 'cancelling' || disposed) return
      child = spawnPython([worker, 'translate', manifest]); job.child = child
      const timeout = setTimeout(() => { timedOut = true; void killTree(child) }, options.timeoutMs)
      let buffer = ''
      const event = async line => {
        if (!line.startsWith('PDFZH:')) return
        let data
        try { data = JSON.parse(line.slice(6)) } catch { return }
        if (data.type === 'progress') {
          Object.assign(job, { progress: Math.min(0.99, Math.max(job.progress, data.progress)), stage: data.stage, currentFile: data.file,
            index: data.index, stageCurrent: data.current, stageTotal: data.stageTotal, part: data.part, parts: data.parts })
        } else if (data.type === 'file-error') job.failures.push({ file: data.file, error: data.error })
        else if (data.type === 'complete' || data.type === 'file-complete') {
          for (const artifact of data.artifacts || []) {
            if (!inside(output, resolve(artifact.path)) || job.files.some(f => f.path === resolve(artifact.path))) continue
            job.files.push(await registerFile(artifact.path, artifact.name, artifact.kind, artifact.inputName))
          }
          job.usage = data.usage || {}
          if (data.type === 'complete') job.failures = data.failures || []
        } else if (data.type === 'error') job.error = data.error
        broadcast()
      }
      child.stdout.on('data', chunk => {
        buffer += chunk.toString(); const lines = buffer.split(/\r?\n/); buffer = lines.pop()
        for (const line of lines) processing = processing.then(() => event(line)).catch(err => { processingError = err })
      })
      child.stderr.on('data', c => { stderr = (stderr + c.toString().split(token).join('[redacted]')).slice(-12000) })
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) }).finally(() => clearTimeout(timeout))
      await processing
      if (processingError) throw processingError
      if (buffer) await event(buffer)
      if (code === 0 && !job.error && !hasExpectedOutputs(job)) await recoverOutputs(job)
      if (job.status === 'cancelling' || disposed) job.status = 'cancelled'
      else if (timedOut) throw fail('Translation timed out')
      else if (code !== 0 || job.error || !job.files.some(f => ['mono', 'dual'].includes(f.kind))) throw fail(job.error || job.failures[0]?.error || `PDF processing failed (${code}); no PDF output was generated`)
      else { job.status = job.failures.length ? 'partial' : 'completed'; job.progress = 1; job.stage = 'Translation complete!' }
    } catch (err) {
      if (job.status === 'cancelling' || disposed) job.status = 'cancelled'
      else { job.status = 'failed'; job.error = errorSummary(err.message); job.logs = logDetails(stderr, err.message) }
    } finally {
      job.child = undefined
      job.logs = logDetails(job.logs, stderr)
      if (gateway) await gateway.close()
      if (job.status === 'cancelling') job.status = 'cancelled'
      job.finishedAt = new Date().toISOString(); active = null
      await persist(); broadcast(); pump()
    }
  }
  function pump() {
    if (active || disposed) return
    const next = [...jobMap.values()].find(j => j.status === 'queued')
    if (next) next.running = runJob(next).catch(err => ctx.logger?.warn?.(`pdfzh: ${err.message}`))
  }
  async function close() {
    disposed = true
    await environmentManager.close()
    for (const controller of controllers) controller.abort()
    for (const job of jobMap.values()) if (['queued', 'running'].includes(job.status)) job.status = 'cancelling'
    await Promise.all([...children].map(killTree))
    await starting
    await active?.running
    for (const res of subscribers) res.end()
    subscribers.clear(); phase = 'stopped'
    if (saveChain) await saveChain.catch(() => {})
  }
  async function serveFile(req, res, file) {
    const size = (await stat(file.path)).size
    if (!size) { res.writeHead(200, { 'Content-Length': 0 }); res.end(); return }
    let start = 0, end = size - 1, code = 200
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
    if (req.headers.range) {
      if (!range || (!range[1] && !range[2])) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return }
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2])); end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1
      if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return }
      code = 206
    }
    const ext = file.name.toLowerCase()
    res.writeHead(code, { 'Content-Type': ext.endsWith('.pdf') ? 'application/pdf' : ext.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/zip',
      'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileView(file).name)}`, ...(code === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) })
    const stream = createReadStream(file.path, { start, end }); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res)
  }
  async function handleApi(req, res) {
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) { res.writeHead(rejection).end(); return }
    const url = new URL(req.url, 'http://local'), path = url.pathname.slice(PREFIX.length)
    if (path === '/status' && req.method === 'GET') return sendJson(res, 200, status())
    if (path === '/start' && req.method === 'POST') {
      if (environmentManager.status().busy) throw fail('环境安装中，请稍候。', 409)
      void start(); return sendJson(res, 202, status())
    }
    if (path === '/environment' && req.method === 'GET') return sendJson(res, 200, environmentManager.status())
    if (path.startsWith('/environment') && ['POST', 'PUT'].includes(req.method)) {
      if (phase === 'starting') throw fail('正在读取环境信息，请稍候。', 409)
      if (path !== '/environment/cancel' && (active || [...jobMap.values()].some(j => j.status === 'queued'))) throw fail('请等待翻译任务结束后再修改或检查环境。', 409)
      if (path === '/environment/cancel') return sendJson(res, 200, await environmentManager.cancel())
      if (path === '/environment/check') {
        if (environmentManager.status().busy) throw fail('环境安装中，请稍候或取消。', 409)
        const input = await json(req)
        return sendJson(res, 200, await environmentManager.check(input.python || undefined))
      }
      if (path === '/environment' && req.method === 'PUT') return sendJson(res, 200, await environmentManager.apply(await json(req)))
      if (path === '/environment/install') return sendJson(res, 202, environmentManager.install(await json(req)))
      throw fail('Not found', 404)
    }
    if (path === '/schema' && req.method === 'GET') return sendJson(res, 200, { fields, defaults, ...localeData })
    if (path === '/models' && req.method === 'GET') return sendJson(res, 200, { models: await listCatalog(ctx.llm) })
    if (path === '/settings' && req.method === 'GET') return sendJson(res, 200, { values: preferences, glossaries: preferences.glossaryIds.filter(id => fileMap.has(id)).map(id => fileView(getFile(id))) })
    if (path === '/settings' && req.method === 'PUT') { preferences = normalize(await json(req)); await persist(); return sendJson(res, 200, { values: preferences }) }
    if (phase !== 'ready' && path !== '/events' && !(req.method === 'DELETE' && path.startsWith('/jobs'))) throw fail('请先在“环境”页面安装或配置 Python。', 503)
    if (path === '/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      subscribers.add(res); res.write(`event: status\ndata: ${JSON.stringify(status())}\n\n`)
      const timer = setInterval(() => res.write(': heartbeat\n\n'), 15000)
      res.on('close', () => { clearInterval(timer); subscribers.delete(res) }); return
    }
    if (path === '/uploads' && req.method === 'POST') return sendJson(res, 201, await upload(await body(req, MAX_UPLOAD), url.searchParams.get('name') || 'document.pdf'))
    if (path === '/links' && req.method === 'POST') {
      const input = await json(req); let address
      try { address = new URL(input.url) } catch { throw fail('Invalid PDF URL') }
      if (!['http:', 'https:'].includes(address.protocol)) throw fail('Only HTTP/HTTPS URLs are supported')
      const controller = new AbortController(); controllers.add(controller)
      const timer = setTimeout(() => controller.abort(), 120000)
      try {
        const response = await fetch(address, { signal: controller.signal })
        if (!response.ok) throw fail(`PDF download failed (${response.status})`)
        if (Number(response.headers.get('content-length')) > MAX_UPLOAD) throw fail('PDF exceeds 200 MB', 413)
        const chunks = []; let size = 0
        for await (const chunk of response.body) { size += chunk.length; if (size > MAX_UPLOAD) { controller.abort(); throw fail('PDF exceeds 200 MB', 413) } chunks.push(chunk) }
        let name; try { name = decodeURIComponent(address.pathname.split('/').pop()) } catch { name = 'download.pdf' }
        if (!name?.toLowerCase().endsWith('.pdf')) name = 'download.pdf'
        return sendJson(res, 201, await upload(Buffer.concat(chunks), name))
      } finally { clearTimeout(timer); controllers.delete(controller) }
    }
    const fileRoute = /^\/files\/([a-f0-9-]+)\/(download|info|preview|glossary)$/.exec(path)
    if (fileRoute && req.method === 'GET') {
      const file = getFile(fileRoute[1]), action = fileRoute[2]
      if (action === 'download') return serveFile(req, res, file)
      if (action === 'glossary') {
        if (!file.name.toLowerCase().endsWith('.csv')) throw fail('Not a glossary')
        return sendJson(res, 200, JSON.parse((await python([worker, 'glossary', file.path])).toString()))
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) throw fail('Not a PDF')
      if (action === 'info') return sendJson(res, 200, JSON.parse((await python([worker, 'inspect', file.path])).toString()))
      const page = Number(url.searchParams.get('page') || 1)
      if (!Number.isInteger(page) || page < 1) throw fail('Invalid page number')
      const image = await python([worker, 'render', file.path, '--page', String(page)])
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=120', 'Content-Length': image.length }); res.end(image); return
    }
    if (path === '/jobs' && req.method === 'POST') {
      if (environmentManager.status().busy) throw fail('环境安装中，请稍候。', 409)
      const input = await json(req), values = normalize(input.values)
      if (!Array.isArray(input.fileIds) || !input.fileIds.length || input.fileIds.length > 100) throw fail('Choose 1–100 PDFs')
      if ([...jobMap.values()].filter(j => ['queued', 'running'].includes(j.status)).length >= 20) throw fail('Translation queue is full', 429)
      const inputs = input.fileIds.map(getFile)
      if (inputs.some(f => f.kind !== 'input')) throw fail('Choose uploaded PDFs')
      for (const id of values.glossaryIds) if (getFile(id).kind !== 'glossary-input') throw fail('Invalid glossary')
      const catalog = await listCatalog(ctx.llm)
      for (const id of [values.model, values.enable_auto_term_extraction && values.termModel].filter(Boolean)) if (!catalog.some(m => m.id === id)) throw fail('Selected model is unavailable; refresh models')
      if (!values.model) throw fail('Choose a Harness model')
      const job = { id: randomUUID(), values, inputs, files: [], failures: [], usage: {}, status: 'queued', progress: 0, stage: 'Queued', createdAt: new Date().toISOString() }
      jobMap.set(job.id, job)
      if (!values.disable_config_auto_save) preferences = values
      await persist(); broadcast(); pump(); return sendJson(res, 202, { job: jobView(job) })
    }
    if (path === '/jobs' && req.method === 'DELETE') {
      let cleared = 0
      for (const [id, job] of jobMap) if (!['queued', 'running', 'cancelling'].includes(job.status)) { jobMap.delete(id); cleared++ }
      await persist(); broadcast(); return sendJson(res, 200, { cleared, ...status() })
    }
    const remove = /^\/jobs\/([a-f0-9-]+)$/.exec(path)
    if (remove && req.method === 'DELETE') {
      const job = getJob(remove[1])
      if (['queued', 'running', 'cancelling'].includes(job.status)) throw fail('Cannot clear an active translation', 409)
      jobMap.delete(job.id); await persist(); broadcast(); return sendJson(res, 200, status())
    }
    const cancel = /^\/jobs\/([a-f0-9-]+)\/cancel$/.exec(path)
    if (cancel && req.method === 'POST') {
      const job = getJob(cancel[1])
      if (job.status === 'queued') { job.status = 'cancelled'; job.finishedAt = new Date().toISOString() }
      else if (job.status === 'running') { job.status = 'cancelling'; await killTree(job.child) }
      await persist(); broadcast(); return sendJson(res, 200, { job: jobView(job) })
    }
    throw fail('Not found', 404)
  }
  function handle(req, res) { void handleApi(req, res).catch(err => {
    if (res.headersSent) res.destroy()
    else sendJson(res, err.status || 400, { error: err.message })
  }) }
  return { start, close, status, handle }
}

export function apply(ctx, config) {
  const runtime = createRuntime(ctx, config)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: runtime.handle }), 'pdfzh: native panel API')
  ctx.effect(() => { void runtime.start(); return () => runtime.close() }, 'pdfzh: PDF engine lifecycle')
}
