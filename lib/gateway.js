/**
 * The loopback OpenAI-compatible gateway.
 *
 * pdf2zh already ships an `OpenAICompatible` engine that sends a plain
 * non-streaming `POST /v1/chat/completions` with `{model, messages}`. This
 * module answers that shape on a loopback socket, translating each call onto
 * `ctx.llm` — the only supported path into provider adapters.
 *
 * Why a separate listener rather than a route on the GUI's server: pdf2zh is a
 * different process, so the port must be knowable outside the browser. A
 * dedicated loopback socket also cannot be reached by a browser origin at all,
 * which removes CORS and ambient-cookie concerns entirely.
 *
 * Two independent gates, both required because any local process can reach the
 * socket: the `Host` header must name loopback (DNS rebinding), and a bearer
 * token must match in constant time.
 *
 * @module dsh-pdf2zh/gateway
 */

import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'

import {
  MAX_BODY_BYTES,
  RequestError,
  isRetryableFailure,
  jsonModeSystem,
  mapFailure,
  toHarnessRequest,
  toOpenAiUsage,
  wantsJsonObject,
} from './protocol.js'

/** Hostnames that count as loopback for the Host header. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Strip the optional `:port` from a Host header, IPv6-bracket aware.
 * @param {unknown} host
 * @returns {string}
 */
export function hostnameOf(host) {
  if (typeof host !== 'string') return ''
  let value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : value.slice(0, end + 1)
  }
  const colon = value.lastIndexOf(':')
  if (colon !== -1 && !value.slice(0, colon).includes(':') && /^\d+$/.test(value.slice(colon + 1))) {
    value = value.slice(0, colon)
  }
  return value
}

/**
 * Whether a Host header names the loopback interface.
 *
 * This is the DNS-rebinding defence: a page on `evil.example.com` that resolves
 * to 127.0.0.1 still sends its own name in Host, so it fails before routing.
 *
 * @param {unknown} host
 * @returns {boolean}
 */
export function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(hostnameOf(host))
}

/**
 * Constant-time bearer-token comparison.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} expected
 * @returns {boolean}
 */
export function bearerOk(req, expected) {
  const header = req.headers.authorization
  if (typeof header !== 'string') return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (match === null) return false
  const a = Buffer.from(match[1])
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Read a request body with a hard byte ceiling.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} [limitBytes]
 * @returns {Promise<Buffer>}
 */
export function readBody(req, limitBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limitBytes) {
        reject(new RequestError(`request body exceeds ${limitBytes} bytes`, {
          status: 413,
          code: 'payload_too_large',
        }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
export function sendJson(res, status, payload) {
  if (res.headersSent || res.writableEnded) return
  const body = Buffer.from(JSON.stringify(payload))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

/**
 * Write one OpenAI-shaped error body.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {string} [type]
 * @param {string} [param]
 */
export function sendOpenAiError(res, status, code, message, type = 'invalid_request_error', param) {
  sendJson(res, status, {
    error: {
      message,
      type,
      code,
      ...(param === undefined ? {} : { param }),
    },
  })
}

/**
 * Turn an exposed model id back into a provider/model pair.
 *
 * Exposed ids are `<provider>/<model>` because the OpenAI `model` field is a
 * single opaque string. `/` is used rather than `_` because provider ids in the
 * wild already contain underscores (`deepseek-account`), which would make
 * `<provider>_<model>` ambiguous.
 *
 * @param {string} raw
 * @param {string[]} providers
 * @returns {{provider: string, model: string} | undefined}
 */
export function splitModelId(raw, providers) {
  if (typeof raw !== 'string' || raw === '') return undefined
  const ordered = [...providers].sort((a, b) => b.length - a.length)
  for (const provider of ordered) {
    const prefix = `${provider}/`
    if (raw.startsWith(prefix) && raw.length > prefix.length) {
      return { provider, model: raw.slice(prefix.length) }
    }
  }
  return undefined
}

/**
 * Build the model catalogue offered over `/v1/models`.
 *
 * `listModels` is best-effort per provider: a provider whose catalogue call
 * throws (signed out, discovery failure) is skipped rather than failing the
 * whole listing, because the remaining providers are still usable.
 *
 * @param {object} llm
 * @returns {Promise<Array<{id: string, provider: string, model: string, name: string, providerName: string}>>}
 */
export async function listCatalog(llm) {
  const entries = []
  const seen = new Set()
  const providers = llm.listProviders()
  const catalogs = await Promise.allSettled(providers.map(provider => Promise.resolve().then(() => llm.listModels(provider.id))))
  for (const [index, provider] of providers.entries()) {
    const catalog = catalogs[index]
    if (catalog.status !== 'fulfilled') continue
    const models = catalog.value
    for (const model of models) {
      const id = `${provider.id}/${model.id}`
      if (seen.has(id)) continue
      seen.add(id)
      entries.push({ id, provider: provider.id, model: model.id,
        name: model.name || model.displayName || model.id,
        providerName: provider.displayName || provider.name || provider.id })
    }
  }
  return entries
}

/**
 * Resolve one requested model id against the live provider registry.
 *
 * Resolution is against `listProviders()` rather than the catalogue so an id the
 * provider can serve but does not advertise still works — the harness itself
 * treats catalogue membership as advisory for routing.
 *
 * @param {string} raw
 * @param {object} llm
 * @returns {{provider: string, model: string}}
 * @throws {RequestError} 404 when nothing matches.
 */
export function resolveRoute(raw, llm) {
  const providers = llm.listProviders().map((entry) => entry.id)
  const split = splitModelId(raw, providers)
  if (split !== undefined) return split
  throw new RequestError(
    `unknown model ${JSON.stringify(raw)}; expected "<provider>/<model>". GET /v1/models lists the available ids.`,
    { status: 404, code: 'model_not_found', param: 'model' },
  )
}

/**
 * Sleep, honouring cancellation.
 * @param {number} ms
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    timer.unref?.()
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('aborted'))
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Run one completion against the harness, retrying transient failures.
 *
 * The harness turns every dispatch failure into a terminal `finish` chunk
 * carrying `kind: 'error'` and a `failure` object — it does NOT throw. A plain
 * try/catch around the loop would therefore silently report success with empty
 * text, so the terminal reason is inspected explicitly on every attempt.
 *
 * @param {object} options
 * @param {object} options.llm
 * @param {object} options.request - harness GenerateOptions.
 * @param {number} options.retries
 * @param {(chunk: object | null) => void} options.onChunk - receives every chunk;
 *   `null` marks a retry boundary so the caller can discard partial output.
 * @param {AbortSignal} options.signal
 * @returns {Promise<{ok: true} | {ok: false, failure: object | undefined}>}
 */
async function runWithRetry({ llm, request, retries, onChunk, signal }) {
  let lastFailure
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      // Exponential backoff with jitter: a shared upstream refusing us needs the
      // herd spread out, not a synchronized retry.
      const backoff = Math.min(2 ** (attempt - 1) * 500, 8000) * (0.5 + Math.random())
      await delay(backoff, signal)
    }
    let terminal
    try {
      for await (const chunk of llm.stream(request)) {
        onChunk(chunk)
        if (chunk.type === 'finish') terminal = chunk.reason
      }
    } catch (error) {
      // A throw here is a harness-internal failure (middleware, cleanup), not a
      // provider refusal — those arrive as a finish chunk instead.
      lastFailure = { code: 'UPSTREAM_FAILED', message: String(error?.message ?? error) }
      if (attempt >= retries) return { ok: false, failure: lastFailure }
      onChunk(null)
      continue
    }

    if (terminal?.kind === 'stop') return { ok: true }
    if (terminal?.kind === 'aborted') {
      return { ok: false, failure: terminal.failure ?? { code: 'ABORTED' } }
    }
    lastFailure = terminal?.failure
      ?? { code: 'UPSTREAM_FAILED', message: 'stream ended without a finish chunk' }
    if (!isRetryableFailure(lastFailure) || attempt >= retries) {
      return { ok: false, failure: lastFailure }
    }
    // A retry restarts the whole completion, so the caller's assembly state must
    // be reset too — signalled by the onChunk handler receiving a `null`.
    onChunk(null)
  }
  return { ok: false, failure: lastFailure }
}

/**
 * Create the loopback gateway.
 *
 * @param {object} options
 * @param {object} options.llm - harness llm service.
 * @param {string} [options.token] - bearer token; omitted disables the gate.
 * @param {boolean} [options.requireToken]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retries]
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {object} [options.logger]
 */
export function createGateway({
  llm,
  token,
  requireToken = true,
  timeoutMs = 300_000,
  retries = 3,
  host = '127.0.0.1',
  port = 0,
  logger,
}) {
  const gated = requireToken && typeof token === 'string' && token !== ''

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      logger?.warn?.(`dsh-pdf2zh: gateway request failed: ${String(error?.message ?? error)}`)
      try {
        if (error instanceof RequestError) {
          sendOpenAiError(res, error.status, error.code, error.message, error.type, error.param)
        } else if (!res.headersSent) {
          sendOpenAiError(res, 500, 'internal_error', String(error?.message ?? error), 'server_error')
        } else if (!res.writableEnded) {
          res.end()
        }
      } catch {
        /* the socket is already gone */
      }
    })
  })

  const ready = new Promise((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', reject)
  })

  let address

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function handle(req, res) {
    // Gate 1: the Host header must name loopback (DNS-rebinding defence).
    if (!isLoopbackHost(req.headers.host)) {
      sendOpenAiError(res, 403, 'host_not_allowed', 'Host header must name the loopback interface', 'forbidden')
      return
    }
    // Gate 2: the bearer token, when configured.
    if (gated && !bearerOk(req, token)) {
      sendOpenAiError(res, 401, 'invalid_api_key', 'missing or invalid Authorization bearer', 'authentication_error')
      return
    }

    const url = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && (url === '/v1/models' || url === '/v1/models/')) {
      const catalog = await listCatalog(llm)
      sendJson(res, 200, {
        object: 'list',
        data: catalog.map((entry) => ({ id: entry.id, object: 'model', created: 0, owned_by: entry.provider })),
      })
      return
    }
    if (req.method === 'GET' && (url === '/healthz' || url === '/healthz/')) {
      sendJson(res, 200, { ok: true, providers: llm.listProviders().length })
      return
    }
    if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/v1/chat/completions/')) {
      await handleChat(req, res)
      return
    }
    sendOpenAiError(res, 404, 'not_found', `no such route: ${req.method} ${url}`, 'invalid_request_error')
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function handleChat(req, res) {
    let body
    try {
      body = JSON.parse((await readBody(req)).toString('utf8'))
    } catch (error) {
      if (error instanceof RequestError) throw error
      throw new RequestError(`malformed JSON body: ${String(error?.message ?? error)}`, {
        status: 400,
        code: 'invalid_json',
      })
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new RequestError('request body must be a JSON object', { status: 400, code: 'invalid_json' })
    }

    const route = resolveRoute(body.model, llm)

    const controller = new AbortController()
    // Two distinct cancellations: the client going away, and our own timeout.
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('gateway request timeout'))
    }, timeoutMs)
    timer.unref?.()
    const onClose = () => {
      if (!res.writableEnded) controller.abort(new Error('client disconnected'))
    }
    res.on('close', onClose)

    try {
      const request = toHarnessRequest(body, route, controller.signal)
      if (wantsJsonObject(body.response_format)) {
        const array = request.messages.some(m => m.content.some(block => /valid JSON array/i.test(block.text || '')))
        request.system = jsonModeSystem(request.system, array)
      }

      let text = ''
      let usage
      const result = await runWithRetry({
        llm,
        request,
        retries,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (chunk === null) {
            // Retry boundary: discard everything assembled so far.
            text = ''
            usage = undefined
            return
          }
          switch (chunk.type) {
            case 'text-delta':
              text += chunk.text
              break
            case 'block-end':
              if (chunk.block?.type === 'text') text = chunk.block.text
              break
            case 'usage':
              usage = chunk.usage
              break
            default:
              break
          }
        },
      })

      if (!result.ok) {
        const mapped = mapFailure(result.failure)
        sendOpenAiError(res, mapped.status, mapped.code, result.failure?.message ?? mapped.code, mapped.type)
        return
      }

      sendJson(res, 200, {
        id: `chatcmpl-${randomBytes(12).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop',
          logprobs: null,
        }],
        usage: toOpenAiUsage(usage),
      })
    } catch (error) {
      if (error instanceof RequestError) throw error
      if (timedOut) {
        throw new RequestError(`request exceeded ${timeoutMs} ms`, { status: 504, code: 'timeout' })
      }
      throw error
    } finally {
      clearTimeout(timer)
      res.off('close', onClose)
    }
  }

  return {
    ready,
    /**
     * Bind the socket.
     * @returns {Promise<{host: string, port: number, baseUrl: string}>}
     */
    async listen() {
      server.listen(port, host)
      await ready
      const bound = server.address()
      if (bound === null || typeof bound === 'string') throw new Error('gateway has no listening address')
      address = { host, port: bound.port, baseUrl: `http://${host}:${bound.port}/v1` }
      return address
    },
    address: () => address,
    /**
     * Close the listener and every open connection.
     * @returns {Promise<void>}
     */
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve()
          return
        }
        server.close(() => resolve())
        server.closeAllConnections?.()
        server.once('error', reject)
      })
    },
  }
}
