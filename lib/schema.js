const field = (id, label, type, value, extra = {}) => ({ id, label, type, default: value, ...extra })
const number = (id, label, value, min = 0, max = 100000, extra = {}) => field(id, label, 'number', value, { min, max, ...extra })
const check = (id, label, value = false, extra = {}) => field(id, label, 'checkbox', value, extra)
const text = (id, label, value = '', extra = {}) => field(id, label, 'text', value, extra)
const select = (id, label, value, choices, extra = {}) => field(id, label, 'select', value, { choices, ...extra })
const pdf = { scope: 'pdf' }, tr = { scope: 'translation' }
export const fields = [
  select('uiLang', 'UI Language', 'zh', [['简体中文', 'zh'], ['English', 'en'], ['繁體中文', 'zh-TW'], ['日本語', 'ja'], ['한국인', 'ko'], ['Français', 'fr'], ['Deutsch', 'de'], ['Español', 'es'], ['Русский', 'ru'], ['Italiano', 'it'], ['Português', 'pt']], { group: 'general' }),
  select('model', 'Translation model', '', [], { group: 'general', model: true }),
  select('lang_in', 'Translate from', 'en', [], { group: 'general', ...tr, language: true }),
  select('lang_out', 'Translate to', 'zh-CN', [], { group: 'general', ...tr, language: true }),
  select('pageMode', 'Pages', 'All', ['All', 'First', 'First 5 pages', 'Range'], { group: 'pages' }),
  text('pages', 'Page range (e.g., 1,3,5-10,-5)', '', { group: 'pages', when: ['pageMode', 'Range'], ...pdf }),
  check('only_include_translated_page', 'Only include translated pages in the output PDF.', false, { group: 'pages', ...pdf }),
  check('no_mono', 'Disable monolingual output', false, { group: 'output', ...pdf }),
  check('no_dual', 'Disable bilingual output', false, { group: 'output', ...pdf }),
  check('dual_translate_first', 'Put translated pages first in dual mode', false, { group: 'output', ...pdf }),
  check('use_alternating_pages_dual', 'Use alternating pages for dual PDF', false, { group: 'output', ...pdf }),
  select('watermark_output_mode', 'Watermark', 'no_watermark', [['Watermarked', 'watermarked'], ['No Watermark', 'no_watermark'], ['Both', 'both']], { group: 'output', ...pdf }),
  select('rateMode', 'Rate limit mode', 'Concurrent Threads', ['RPM', 'Concurrent Threads', 'Custom'], { group: 'rate' }),
  number('rpm', 'RPM (Requests Per Minute)', 240, 1, 100000, { group: 'rate', when: ['rateMode', 'RPM'] }),
  number('threads', 'Concurrent Requests', 8, 1, 1000, { group: 'rate', when: ['rateMode', 'Concurrent Threads'] }),
  number('qps', 'QPS (Queries Per Second)', 4, 1, 1000, { group: 'rate', when: ['rateMode', 'Custom'] }),
  number('pool_max_workers', 'Pool Max Workers', 0, 0, 1000, { group: 'rate', when: ['rateMode', 'Custom'] }),
  number('timeout', 'Request timeout (seconds)', 300, 1, 3600, { group: 'rate' }),
  check('sendTemperature', 'Send temperature', false, { group: 'rate' }),
  number('temperature', 'Temperature', 1, 0, 2, { group: 'rate', step: 0.1, when: ['sendTemperature', true] }),
  check('jsonMode', 'Enable JSON mode', false, { group: 'rate' }),
  check('enable_auto_term_extraction', 'Enable auto term extraction', true, { group: 'term' }),
  select('termModel', 'Term extraction model', '', [], { group: 'term', model: true, follow: true, enabledBy: 'enable_auto_term_extraction' }),
  select('termRateMode', 'Term extraction rate limit mode', 'Concurrent Threads', ['RPM', 'Concurrent Threads', 'Custom'], { group: 'term', enabledBy: 'enable_auto_term_extraction' }),
  number('termRpm', 'RPM (Requests Per Minute)', 240, 1, 100000, { group: 'term', when: ['termRateMode', 'RPM'], enabledBy: 'enable_auto_term_extraction' }),
  number('termThreads', 'Concurrent Requests', 8, 1, 1000, { group: 'term', when: ['termRateMode', 'Concurrent Threads'], enabledBy: 'enable_auto_term_extraction' }),
  number('termQps', 'QPS (Queries Per Second)', 4, 1, 1000, { group: 'term', when: ['termRateMode', 'Custom'], enabledBy: 'enable_auto_term_extraction' }),
  number('termPool', 'Pool Max Workers', 0, 0, 1000, { group: 'term', when: ['termRateMode', 'Custom'], enabledBy: 'enable_auto_term_extraction' }),
  number('termTimeout', 'Request timeout (seconds)', 300, 1, 3600, { group: 'term', enabledBy: 'enable_auto_term_extraction' }),
  check('termSendTemperature', 'Send temperature', false, { group: 'term', enabledBy: 'enable_auto_term_extraction' }),
  number('termTemperature', 'Temperature', 1, 0, 2, { group: 'term', step: 0.1, when: ['termSendTemperature', true], enabledBy: 'enable_auto_term_extraction' }),
  check('termJsonMode', 'Enable JSON mode', true, { group: 'term', enabledBy: 'enable_auto_term_extraction' }),
  check('save_auto_extracted_glossary', 'save automatically extracted glossary', false, { group: 'term', ...tr }),
  field('prompt', 'Custom prompt for translation', 'textarea', '', { group: 'advanced', hint: 'Additional translation instructions. Supports $lang_in and $lang_out.' }),
  field('custom_system_prompt', 'Custom System Prompt', 'textarea', '', { group: 'advanced', ...tr }),
  number('min_text_length', 'Minimum text length to translate', 5, 0, 100000, { group: 'advanced', ...tr }),
  text('rpc_doclayout', 'RPC service for document layout analysis (optional)', '', { group: 'advanced', ...tr }),
  select('primary_font_family', 'Primary font family for translated text', '', [['Automatic', ''], ['Serif', 'serif'], ['Sans Serif', 'sans-serif'], ['Script', 'script']], { group: 'advanced', ...tr }),
  check('skip_clean', 'Skip clean (maybe improve compatibility)', false, { group: 'advanced', ...pdf, disabledBy: 'enhance_compatibility' }),
  check('disable_rich_text_translate', 'Disable rich text translation (maybe improve compatibility)', false, { group: 'advanced', ...pdf, disabledBy: 'enhance_compatibility' }),
  check('enhance_compatibility', 'Enhance compatibility (auto-enables skip_clean and disable_rich_text)', false, { group: 'advanced', ...pdf }),
  check('split_short_lines', 'Force split short lines into different paragraphs', false, { group: 'advanced', ...pdf }),
  number('short_line_split_factor', 'Short line split threshold factor', 0.8, 0.1, 1, { group: 'advanced', type: 'range', step: 0.1, when: ['split_short_lines', true], ...pdf }),
  check('translate_table_text', 'Translate table text (experimental)', true, { group: 'advanced', ...pdf }),
  check('skip_scanned_detection', 'Skip scanned detection', false, { group: 'advanced', ...pdf }),
  check('ocr_workaround', 'OCR workaround (experimental, will auto enable Skip scanned detection in backend)', false, { group: 'advanced', ...pdf }),
  check('auto_enable_ocr_workaround', 'Auto enable OCR workaround (enable automatic OCR workaround for heavily scanned documents)', false, { group: 'advanced', ...pdf }),
  number('max_pages_per_part', 'Maximum pages per part (for auto-split translation, 0 means no limit)', 0, 0, 100000, { group: 'advanced', ...pdf }),
  text('formular_font_pattern', 'Font pattern to identify formula text (regex, not recommended to change)', '', { group: 'advanced', ...pdf }),
  text('formular_char_pattern', 'Character pattern to identify formula text (regex, not recommended to change)', '', { group: 'advanced', ...pdf }),
  check('ignore_cache', 'Ignore cache', false, { group: 'advanced', ...tr }),
  check('merge_alternating_line_numbers', 'Merge alternating line numbers', true, { group: 'advanced' }),
  check('remove_non_formula_lines', 'Remove non-formula lines', true, { group: 'advanced' }),
  number('non_formula_line_iou_threshold', 'Non-formula line IoU threshold', 0.9, 0, 1, { group: 'advanced', type: 'range', step: 0.05, ...pdf }),
  number('figure_table_protection_threshold', 'Figure/table protection threshold', 0.9, 0, 1, { group: 'advanced', type: 'range', step: 0.05, ...pdf }),
  check('skip_formula_offset_calculation', 'Skip formula offset calculation', false, { group: 'advanced', ...pdf }),
  check('disable_config_auto_save', 'Disable automatic saving of configuration', false, { group: 'general' }),
]
export const defaults = Object.fromEntries(fields.map(x => [x.id, x.default]))
export function normalize(raw = {}) {
  const result = { ...defaults }
  for (const f of fields) {
    if (!(f.id in raw)) continue
    const v = raw[f.id]
    if (f.type === 'checkbox') { if (typeof v !== 'boolean') throw new Error(`${f.label}: expected boolean`) }
    else if (f.type === 'number' || f.type === 'range') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < f.min || v > f.max || (!f.step && !Number.isInteger(v))) throw new Error(`${f.label}: ${f.min}–${f.max}`)
    } else if (typeof v !== 'string' || v.length > 32000) throw new Error(`${f.label}: invalid text`)
    if (f.choices?.length && !f.choices.some(c => (Array.isArray(c) ? c[1] : c) === v)) throw new Error(`${f.label}: invalid choice`)
    result[f.id] = v
  }
  if (result.no_mono && result.no_dual) throw new Error('Cannot disable both monolingual and bilingual output')
  if (result.pageMode === 'Range') {
    const valid = result.pages.trim().split(',').every(part => {
      const range = /^(\d*)\s*-\s*(\d*)$/.exec(part.trim())
      if (range) return Boolean(range[1] || range[2]) && (!range[1] || Number(range[1]) >= 1) && (!range[2] || Number(range[2]) >= 1) && (!range[1] || !range[2] || Number(range[2]) >= Number(range[1]))
      return /^\d+$/.test(part.trim()) && Number(part) >= 1
    })
    if (!valid) throw new Error('Invalid page range')
  }
  if (result.enhance_compatibility) { result.skip_clean = true; result.disable_rich_text_translate = true }
  if (result.ocr_workaround) result.skip_scanned_detection = true
  result.glossaryIds = Array.isArray(raw.glossaryIds) ? raw.glossaryIds.filter(x => typeof x === 'string').slice(0, 50) : []
  return result
}
export function rate(mode, rpm, threads, qps, pool) {
  if (mode === 'RPM') { const q = Math.max(1, Math.floor(rpm / 60)); return [q, Math.min(1000, q * 10)] }
  if (mode === 'Concurrent Threads') return [threads, threads]
  return [qps, pool || null]
}
export function buildSettings(v, { baseUrl, token, output, glossaryPaths = [] }) {
  const translation = {}, pdf = {}
  for (const f of fields) {
    if (f.scope) (f.scope === 'pdf' ? pdf : translation)[f.id] = v[f.id] === '' ? null : v[f.id]
  }
  const [qps, pool] = rate(v.rateMode, v.rpm, v.threads, v.qps, v.pool_max_workers)
  const [termQps, termPool] = rate(v.termRateMode, v.termRpm, v.termThreads, v.termQps, v.termPool)
  Object.assign(translation, { output, qps, pool_max_workers: pool, term_qps: termQps, term_pool_max_workers: termPool,
    no_auto_extract_glossary: !v.enable_auto_term_extraction, glossaries: glossaryPaths.join(',') || null })
  pdf.pages = ({ All: null, First: '1', 'First 5 pages': '1-5', Range: v.pages })[v.pageMode]
  pdf.max_pages_per_part ||= null
  pdf.no_merge_alternating_line_numbers = !v.merge_alternating_line_numbers
  pdf.no_remove_non_formula_lines = !v.remove_non_formula_lines
  const engine = (term) => ({ translate_engine_type: 'OpenAI', openai_model: term ? 'term/selected' : 'main/selected',
    openai_base_url: baseUrl, openai_api_key: token, openai_timeout: String(term ? v.termTimeout : v.timeout),
    openai_send_temprature: term ? v.termSendTemperature : v.sendTemperature,
    openai_temperature: String(term ? v.termTemperature : v.temperature),
    openai_enable_json_mode: term ? v.termJsonMode : v.jsonMode })
  return { report_interval: 0.2, basic: {}, translation, pdf, translate_engine_settings: engine(false),
    term_extraction_engine_settings: v.termModel && v.enable_auto_term_extraction ? engine(true) : null }
}
