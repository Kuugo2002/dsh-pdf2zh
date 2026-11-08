/**
 * Translation between the OpenAI Chat Completions wire format (what pdf2zh
 * speaks) and the DeepSeek Harness chunk protocol (what `ctx.llm` speaks).
 *
 * Everything here is pure: no I/O, no service handles, no timers. That keeps
 * the one part where the two systems genuinely disagree — the message shape —
 * directly unit-testable without a harness.
 *
 * @module dsh-pdf2zh/protocol
 */

/**
 * Raised when a request cannot be turned into a harness request at all.
 * Carries OpenAI-style error fields so the HTTP layer stays a thin mapper.
 */
export class RequestError extends Error {
  /**
   * @param {string} message - human-readable detail.
   * @param {object} fields
   * @param {number} fields.status - HTTP status to answer with.
   * @param {string} fields.code - stable machine code for the client.
   * @param {string} [fields.type] - OpenAI `error.type`.
   * @param {string} [fields.param] - offending field name.
   */
  constructor(message, { status, code, type = 'invalid_request_error', param }) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.code = code
    this.type = type
    if (param !== undefined) this.param = param
  }
}

/** Upper bound on one request body. Well above any real prompt pdf2zh sends. */
export const MAX_BODY_BYTES = 32 * 1024 * 1024

/**
 * Flatten one OpenAI message `content` value into plain text.
 *
 * pdf2zh always sends a string, but OpenAI clients in general may send an array
 * of parts. Non-text parts are dropped rather than rejected: a translation
 * request has nothing useful to do with an image, and failing the whole call
 * over one stray part would be worse than ignoring it.
 *
 * @param {unknown} content
 * @returns {string} the concatenated text.
 */
export function flattenContent(content) {
  if (typeof content === 'string') return content
  if (content === null || content === undefined) return ''
  if (Array.isArray(content)) {
    let text = ''
    for (const part of content) {
      if (typeof part === 'string') {
        text += part
        continue
      }
      if (part === null || typeof part !== 'object') continue
      if (part.type === 'text' && typeof part.text === 'string') text += part.text
    }
    return text
  }
  if (typeof content === 'object' && typeof content.text === 'string') return content.text
  return ''
}

/**
 * Convert an OpenAI `messages` array into the harness request shape.
 *
 * The one real disagreement between the two protocols: the harness carries the
 * system prompt as a request-level string (`options.system`), never as a turn
 * in the message list. System and developer turns are therefore hoisted out and
 * joined in encounter order; everything else becomes a text block.
 *
 * Turns with no text at all are dropped — an empty text block makes some
 * adapters reject the request, and it carries no signal.
 *
 * @param {unknown} raw - the `messages` field, of unknown shape.
 * @returns {{messages: Array<{role: string, content: Array<{type: 'text', text: string}>}>, system: string}}
 */
export function toHarnessMessages(raw) {
  if (!Array.isArray(raw)) {
    throw new RequestError('messages must be an array', { status: 400, code: 'invalid_messages', param: 'messages' })
  }
  const messages = []
  const systemParts = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue
    const text = flattenContent(entry.content)
    const role = typeof entry.role === 'string' ? entry.role : 'user'
    // A whitespace-only turn carries no signal and some adapters reject an empty
    // text block, so it is dropped rather than forwarded. The real text is
    // forwarded verbatim — trimming it would alter what gets translated.
    if (text.trim() === '') continue
    if (role === 'system' || role === 'developer') {
      systemParts.push(text)
      continue
    }
    // The harness speaks `user` and `assistant`; tool turns are re-labelled as
    // user text because a translation request never carries real tool calls.
    const harnessRole = role === 'assistant' ? 'assistant' : 'user'
    messages.push({ role: harnessRole, content: [{ type: 'text', text }] })
  }
  if (messages.length === 0) {
    throw new RequestError('messages must contain at least one non-empty turn', {
      status: 400,
      code: 'invalid_messages',
      param: 'messages',
    })
  }
  return { messages, system: systemParts.join('\n\n') }
}

/**
 * Whether a request asked for JSON output.
 *
 * Only `{type: 'json_object'}` matters. The harness sampling surface has no
 * `response_format` passthrough, so this is answered in the prompt instead —
 * see {@link jsonModeSystem}.
 *
 * @param {unknown} responseFormat
 * @returns {boolean}
 */
export function wantsJsonObject(responseFormat) {
  if (responseFormat === null || typeof responseFormat !== 'object') return false
  return responseFormat.type === 'json_object'
}

/** Instruction appended to the system prompt when JSON output is requested. */
const JSON_MODE_INSTRUCTION =
  'Return ONLY a single valid JSON object. Do not wrap it in markdown fences, do not add prose before or after it.'

/**
 * Fold the JSON-mode instruction into a system prompt.
 *
 * pdf2zh's term extraction parses the reply as JSON and degrades (logs and
 * continues) when it cannot; it never aborts the document. So the worst case
 * here is a weaker glossary, not a failed translation. This is why prompt-level
 * compensation is an acceptable substitute for a real `response_format` flag.
 *
 * @param {string} system - the request-level system prompt.
 * @returns {string}
 */
export function jsonModeSystem(system, array = false) {
  const instruction = array ? JSON_MODE_INSTRUCTION.replace('JSON object', 'JSON array') : JSON_MODE_INSTRUCTION
  return system === '' || system === undefined ? instruction : `${system}\n\n${instruction}`
}

/**
 * Build the harness `GenerateOptions` for one OpenAI chat request.
 *
 * Sampling is limited on purpose: the harness supports `temperature`,
 * `maxTokens`, and `stop` only, so every other OpenAI knob is ignored rather
 * than silently reinterpreted.
 *
 * @param {object} body - the parsed OpenAI request body.
 * @param {{provider: string, model: string}} route - the resolved provider/model.
 * @param {AbortSignal} signal
 * @returns {object} harness GenerateOptions.
 */
export function toHarnessRequest(body, route, signal) {
  const { messages, system } = toHarnessMessages(body.messages)
  const request = { provider: route.provider, model: route.model, messages, signal }
  if (system !== '') request.system = system
  const options = {}
  if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
    options.temperature = body.temperature
  }
  if (typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)) {
    options.maxTokens = Math.trunc(body.max_tokens)
  }
  if (typeof body.stop === 'string') options.stop = [body.stop]
  else if (Array.isArray(body.stop)) options.stop = body.stop.filter((entry) => typeof entry === 'string')
  if (Object.keys(options).length > 0) request.options = options
  return request
}

/**
 * Whether a terminal failure is worth retrying.
 *
 * pdf2zh issues hundreds of sequential calls per document; one rate limit must
 * not abandon the whole run, while an auth or quota failure will never succeed
 * on retry and should surface immediately.
 *
 * @param {object | undefined} failure
 * @returns {boolean}
 */
export function isRetryableFailure(failure) {
  if (failure === undefined || failure === null) return false
  const code = typeof failure.code === 'string' ? failure.code.toUpperCase() : ''
  return code === 'RATE_LIMIT' || code === 'OVERLOADED' || code === 'TIMEOUT'
    || code === 'UPSTREAM_FAILED' || code === 'SERVER_ERROR' || code === 'NETWORK'
}

/**
 * Map a harness terminal failure onto an OpenAI-shaped error triple.
 *
 * @param {object | undefined} failure
 * @returns {{status: number, code: string, type: string}}
 */
export function mapFailure(failure) {
  const raw = typeof failure?.code === 'string' ? failure.code.toUpperCase() : ''
  switch (raw) {
    case 'RATE_LIMIT':
    case 'OVERLOADED':
      return { status: 429, code: 'rate_limit_exceeded', type: 'rate_limit_error' }
    case 'QUOTA':
    case 'ACCOUNT_QUOTA':
      return { status: 402, code: 'insufficient_quota', type: 'insufficient_quota' }
    case 'AUTH':
    case 'MISSING_CREDENTIAL':
    case 'INVALID_CREDENTIAL':
      return { status: 401, code: 'invalid_api_key', type: 'authentication_error' }
    case 'CONTEXT_WINDOW_EXCEEDED':
      return { status: 413, code: 'context_length_exceeded', type: 'invalid_request_error' }
    case 'ABORTED':
      return { status: 499, code: 'request_aborted', type: 'invalid_request_error' }
    case 'NO_ADAPTER':
      return { status: 503, code: 'provider_unavailable', type: 'server_error' }
    case 'TIMEOUT':
      return { status: 504, code: 'timeout', type: 'server_error' }
    default:
      return { status: 502, code: 'upstream_failed', type: 'server_error' }
  }
}

/**
 * Project harness usage numbers into the OpenAI `usage` object.
 *
 * pdf2zh only reports token totals, and tolerates a missing `usage` entirely, so
 * absent numbers are omitted rather than invented as zero.
 *
 * @param {object | undefined} usage
 * @returns {object}
 */
export function toOpenAiUsage(usage) {
  const prompt = numberOrUndefined(usage?.inputTokens ?? usage?.promptTokens)
  const completion = numberOrUndefined(usage?.outputTokens ?? usage?.completionTokens)
  const total = numberOrUndefined(usage?.totalTokens)
    ?? (prompt !== undefined && completion !== undefined ? prompt + completion : undefined)
  return {
    ...(prompt === undefined ? {} : { prompt_tokens: prompt }),
    ...(completion === undefined ? {} : { completion_tokens: completion }),
    ...(total === undefined ? {} : { total_tokens: total }),
  }
}

/**
 * @param {unknown} value
 * @returns {number | undefined}
 */
function numberOrUndefined(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
