/* Native React client for the Harness slot system. No Gradio runtime or GUI embedding. */
window.__ModuleLoader__.load({
  id: 'dsh-pdfzh',
  factory: (require) => {
    const React = require('react')
    const { useState, useEffect, useRef } = React
    const h = React.createElement
    const zh = {
      'PDF translation': 'PDF 翻译', Translation: '翻译', Settings: '设置', History: '任务记录',
      'Translation Options': '翻译选项', Watermark: '水印',
      'Translation model': '翻译模型', 'Term extraction model': '术语提取模型',
      'Refresh models': '刷新模型', 'Follow main translation engine': '跟随翻译模型',
      'Source PDFs': '源 PDF', 'Add PDFs': '添加 PDF', 'Drop PDFs here': '将 PDF 拖放到这里',
      'Clear files': '清空文件', Remove: '移除', Preview: '预览',
      'PDF URL': 'PDF 链接', 'Add URL': '添加链接', 'Download source PDF': '下载源文件',
      'Choose a Harness model': '请选择 Harness 模型', 'No models available': '暂无模型，请先在 Harness 中登录服务商并刷新',
      'Preparing PDF engine…': '正在准备 PDF 翻译引擎…', 'Retry': '重试',
      'Save Settings': '保存设置', 'Reload settings': '重载设置', 'Reset to defaults': '恢复默认设置',
      Saved: '已保存', 'Unsaved changes': '设置未保存', 'Save failed': '保存失败',
      'Output settings': '输出设置', 'Translation rate limit': '翻译速率', 'Rate limit mode': '限速方式',
      'Term extraction rate limit mode': '术语提取限速方式', 'Request timeout (seconds)': '请求超时（秒）',
      'Send temperature': '发送温度参数', Temperature: '温度', 'Enable JSON mode': '启用 JSON 模式',
      'Disable automatic saving of configuration': '关闭自动保存设置', Automatic: '自动',
      'Additional translation instructions. Supports $lang_in and $lang_out.': '附加翻译要求，支持 $lang_in 和 $lang_out 语言占位符。',
      'Glossary files': '术语表文件', 'Add CSV glossaries': '添加 CSV 术语表',
      'No glossary selected': '尚未添加术语表', 'Source': '原文', Target: '译文',
      'Total rows': '总行数', 'Showing first 500 rows': '最多预览前 500 行',
      'Document preview': '文档预览', 'Choose a document': '选择预览文件', 'No PDF selected': '选择 PDF 后显示预览',
      'Previous page': '上一页', 'Next page': '下一页', Page: '页', Zoom: '缩放',
      'Preview unavailable': '暂时无法预览', 'No jobs yet': '还没有翻译任务',
      queued: '排队中', running: '翻译中', cancelling: '取消中', cancelled: '已取消', completed: '已完成', partial: '部分完成', failed: '失败',
      'Download results': '下载结果', 'Monolingual PDF': '单语 PDF', 'Bilingual PDF': '双语 PDF',
      Glossary: '术语表', 'All results ZIP': '全部结果 ZIP', 'Monolingual ZIP': '单语版 ZIP',
      'Bilingual ZIP': '双语版 ZIP', 'Glossaries ZIP': '术语表 ZIP',
      'Token usage': 'Token 用量', Total: '总计', Prompt: '输入', Completion: '输出',
      'View logs': '查看日志', Expand: '展开界面', 'Exit fullscreen': '退出全屏',
      'Clear record': '删除此条及文件', 'Delete selected': '删除所选', 'Clear all': '清除所有', 'Select all': '全选',
      'Select task': '选择任务', 'Deleting…': '正在删除…',
      'History cleanup hint': '删除任务会同时删除对应文件。清除所有还会清理历史残留；其他任务和当前术语表使用的文件会保留。运行或排队中的任务需先取消或等待结束。',
      Environment: '环境',
      'Upload in progress': '正在上传', 'Working…': '处理中…',
      'Select files and a model first': '请先添加 PDF 并选择模型',
      'Swap languages': '交换语言', 'Auto detect': '自动识别',
      'Reset settings?': '恢复所有选项的默认值？', 'View glossary': '查看术语表', Close: '关闭',
    }
    const style = `
.pdfzh{--pz-line:var(--border-color,#dce1e8);--pz-bg:var(--background-color,#fff);--pz-soft:var(--background-color-secondary,#f5f7fa);--pz-fg:var(--text-color,#172435);--pz-blue:#4b6bfb;color:var(--pz-fg);background:var(--pz-bg);font:13px/1.55 system-ui,sans-serif;display:flex;flex-direction:column;height:100%;min-height:400px;container-type:inline-size}
.pdfzh *{box-sizing:border-box}.pdfzh button,.pdfzh input,.pdfzh select,.pdfzh textarea{font:inherit;color:inherit}.pdfzh button{cursor:pointer;border:1px solid var(--pz-line);border-radius:7px;background:var(--pz-bg);padding:6px 11px}.pdfzh button:hover{border-color:var(--pz-blue)}.pdfzh button:disabled{opacity:.45;cursor:default}.pdfzh button.primary{background:var(--pz-blue);border-color:var(--pz-blue);color:#fff}.pdfzh button.danger{color:#c43c4b}.pdfzh a{color:var(--pz-blue);text-decoration:none}.pdfzh a:hover{text-decoration:underline}.pdfzh input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),.pdfzh select,.pdfzh textarea{border:1px solid var(--pz-line);border-radius:7px;padding:8px 10px;background:var(--pz-bg);width:100%;min-width:0}.pdfzh input:focus,.pdfzh select:focus,.pdfzh textarea:focus{outline:2px solid #6f87ff55;outline-offset:1px}.pdfzh textarea{resize:vertical;min-height:90px}.pdfzh input[type=checkbox]{accent-color:var(--pz-blue)}.pdfzh input[type=range]{accent-color:var(--pz-blue);width:100%}.pdfzh .pz-top{padding:12px 16px;border-bottom:1px solid var(--pz-line);display:flex;gap:10px;align-items:center;flex-wrap:wrap}.pdfzh .pz-title{font-size:16px;font-weight:650;flex:1}.pdfzh .pz-pill{font-size:11px;background:var(--pz-soft);padding:2px 7px;border-radius:20px}.pdfzh .pz-tabs{display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid var(--pz-line)}.pdfzh .pz-tabs button{border-color:transparent;background:transparent}.pdfzh .pz-tabs button.active{background:#4b6bfb15;color:var(--pz-blue)}.pdfzh .pz-body{overflow:auto;flex:1;min-height:0;padding:16px}.pdfzh .pz-work{display:grid;grid-template-columns:1fr;gap:16px}.pdfzh .pz-card{border:1px solid var(--pz-line);border-radius:11px;padding:14px;margin-bottom:14px}.pdfzh .pz-card h3{font-size:14px;margin:0 0 12px;font-weight:650}.pdfzh .pz-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pdfzh .pz-row.spread{justify-content:space-between}.pdfzh .pz-fields{display:grid;grid-template-columns:1fr;gap:12px}.pdfzh .pz-field{display:flex;flex-direction:column;gap:5px;min-width:0}.pdfzh .pz-field.check{flex-direction:row;align-items:flex-start;gap:8px}.pdfzh .pz-field.check input{margin-top:4px}.pdfzh .pz-label{font-size:12px;font-weight:550}.pdfzh .pz-hint{font-size:11px;opacity:.65}.pdfzh .pz-file{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--pz-line)}.pdfzh .pz-file:last-child{border-bottom:0}.pdfzh .pz-file-name{flex:1;min-width:0;overflow-wrap:anywhere}.pdfzh .pz-muted{opacity:.6}.pdfzh .pz-drop{border:1px dashed #92a3d4;border-radius:9px;padding:18px 12px;text-align:center;background:#4b6bfb05;margin-bottom:12px}.pdfzh .pz-alert{border-radius:8px;background:#c43c4b12;color:#b83042;padding:10px 14px;margin:10px 16px;overflow-wrap:anywhere}.pdfzh .pz-progress{width:100%;height:7px;accent-color:var(--pz-blue);margin:9px 0}.pdfzh .pz-preview{background:var(--pz-soft);border-radius:8px;overflow:auto;max-height:65vh;min-height:260px;display:flex;align-items:flex-start;justify-content:center;padding:12px}.pdfzh .pz-preview img{display:block;max-width:none;box-shadow:0 2px 12px #0002}.pdfzh .pz-preview .pz-empty{align-self:center;text-align:center;padding:40px 8px}.pdfzh .pz-pagination{display:flex;gap:8px;align-items:center;justify-content:center;margin:10px 0;flex-wrap:wrap}.pdfzh .pz-pagination input{max-width:68px}.pdfzh details>summary{cursor:pointer;font-weight:600;padding:4px 0}.pdfzh details[open]>summary{margin-bottom:12px}.pdfzh .pz-results{display:flex;flex-direction:column;gap:8px}.pdfzh .pz-results a{display:inline-block}.pdfzh .pz-table-scroll{overflow:auto;max-height:320px}.pdfzh table{border-collapse:collapse;width:100%}.pdfzh th,.pdfzh td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--pz-line);white-space:pre-wrap;overflow-wrap:anywhere}.pdfzh .pz-sticky{position:sticky;bottom:0;padding:10px;background:var(--pz-bg);border-top:1px solid var(--pz-line);display:flex;gap:8px;justify-content:flex-end}.pdfzh pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.pdfzh .pz-log{max-height:320px;max-height:min(320px,45vh);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:10px;border:1px solid var(--pz-line);border-radius:7px}.pdfzh .pz-modal{position:fixed;inset:5%;z-index:10000;background:var(--pz-bg);border:1px solid var(--pz-line);border-radius:12px;box-shadow:0 8px 80px #0005;padding:20px;overflow:auto}.pdfzh:fullscreen{height:100vh;padding:10px}.pdfzh .pz-job{margin-top:12px}.pdfzh .pz-result-group{padding:8px 0;border-top:1px solid var(--pz-line)}
.pdfzh .pz-env-modes{gap:12px 24px}.pdfzh .pz-env-mode{display:inline-flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap}.pdfzh .pz-env-mode input[type=radio]{appearance:auto;flex:0 0 auto;width:14px;height:14px;margin:0;padding:0;accent-color:var(--pz-blue)}
@container(min-width:650px){.pdfzh .pz-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.pdfzh .pz-field:has(textarea){grid-column:1/-1}}
@container(min-width:950px){.pdfzh .pz-work{grid-template-columns:minmax(330px,.9fr) minmax(420px,1.3fr)}}
@media(prefers-color-scheme:dark){.pdfzh{--pz-bg:var(--background-color,#181c24);--pz-soft:var(--background-color-secondary,#222733);--pz-line:var(--border-color,#353c49);--pz-fg:var(--text-color,#e1e7f2)}}`

    function PdfzhPanel() {
      const [schema, setSchema] = useState(null), [values, setValues] = useState({}), [models, setModels] = useState([])
      const [status, setStatus] = useState({ phase: 'starting', jobs: [] }), [tab, setTab] = useState('main')
      const [files, setFiles] = useState([]), [glossaries, setGlossaries] = useState([]), [previewId, setPreviewId] = useState('')
      const [page, setPage] = useState(1), [pages, setPages] = useState(1), [zoom, setZoom] = useState(100), [previewError, setPreviewError] = useState('')
      const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [uploadProgress, setUploadProgress] = useState(null)
      const [link, setLink] = useState(''), [sourceMode, setSourceMode] = useState('File'), [saveState, setSaveState] = useState(''), [glossaryView, setGlossaryView] = useState(null)
      const [envMode, setEnvMode] = useState('managed'), [envPath, setEnvPath] = useState(''), [envIndex, setEnvIndex] = useState('https://pypi.tuna.tsinghua.edu.cn/simple'), [envCheck, setEnvCheck] = useState(null)
      const [envSaveState, setEnvSaveState] = useState('idle'), envSaving = useRef(false)
      const [selectedJobs, setSelectedJobs] = useState([]), [historyDeleting, setHistoryDeleting] = useState(false)
      const root = useRef(null), pdfInput = useRef(null), csvInput = useRef(null), loaded = useRef(false), valuesRef = useRef(values)
      valuesRef.current = values
      const base = new URL('api/pdfzh/', document.baseURI)
      const url = path => new URL(path, base).href
      const t = key => schema?.locales?.[values.uiLang]?.[key] || (values.uiLang === 'zh' ? zh[key] : null) || key
      const api = async (path, method = 'GET', data) => {
        const response = await fetch(url(path), { method, credentials: 'same-origin', ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
        return result
      }
      const action = fn => async (...args) => { setMessage(''); try { return await fn(...args) } catch (err) { setMessage(err.message) } }
      const refreshModels = async () => { const data = await api('models'); setModels(data.models); return data.models }
      const loadSettings = async () => {
        const data = await api('settings'); setValues(data.values); setGlossaries(data.glossaries); setSaveState('Saved')
      }
      useEffect(() => {
        let mounted = true, stream, timer, hydrated = false
        const poll = async () => {
          try {
            const next = await api('status'); if (!mounted) return
            setStatus(next)
            if (['ready', 'needs_environment', 'failed'].includes(next.phase) && !hydrated) {
              hydrated = true
              const [schemaData, settingsData, modelData] = await Promise.all([api('schema'), api('settings'), api('models')])
              if (!mounted) return
              setSchema(schemaData); setGlossaries(settingsData.glossaries); setModels(modelData.models)
              const v = settingsData.values
              if (!v.model && modelData.models[0]) v.model = modelData.models[0].id
              setValues(v); setSaveState('Saved'); loaded.current = true
              if (next.phase !== 'ready') setTab('environment')
              stream?.close()
              stream = new EventSource(url('events'), { withCredentials: true })
              stream.addEventListener('status', event => { if (mounted) setStatus(JSON.parse(event.data)) })
              stream.onerror = () => {} // Polling also recovers missed events/reconnections.
            }
          } catch (err) { if (mounted) { setMessage(err.message); hydrated = false } }
        }
        poll(); timer = setInterval(poll, 4000)
        return () => { mounted = false; clearInterval(timer); stream?.close(); loaded.current = false }
      }, [])
      useEffect(() => {
        const config = status.environment?.config
        if (config) { setEnvMode(config.mode); setEnvPath(config.customPath || ''); setEnvIndex(config.indexUrl || 'https://pypi.tuna.tsinghua.edu.cn/simple') }
      }, [status.environment?.config?.mode, status.environment?.config?.customPath, status.environment?.config?.indexUrl])
      useEffect(() => { setEnvSaveState('idle') }, [envMode, envPath, envIndex])
      useEffect(() => {
        if (!loaded.current) return
        setSaveState('Unsaved changes')
        if (values.disable_config_auto_save) return
        let active = true
        const timer = setTimeout(() => {
          api('settings', 'PUT', values).then(() => { if (active) setSaveState('Saved') }).catch(err => { if (active) { setSaveState('Save failed'); setMessage(err.message) } })
        }, 700)
        return () => { active = false; clearTimeout(timer) }
      }, [values])
      useEffect(() => {
        setPage(1); setPages(1); setPreviewError('')
        if (!previewId) return
        let active = true
        api(`files/${previewId}/info`).then(data => { if (active) setPages(data.pages) }).catch(err => { if (active) setPreviewError(err.message) })
        return () => { active = false }
      }, [previewId])

      const change = (id, value) => setValues(current => {
        const next = { ...current, [id]: value }
        if (id === 'enhance_compatibility' && value) { next.skip_clean = true; next.disable_rich_text_translate = true }
        if (id === 'ocr_workaround' && value) next.skip_scanned_detection = true
        return next
      })
      const uploadOne = (file) => new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('POST', url('uploads?name=' + encodeURIComponent(file.name))); request.withCredentials = true
        request.upload.onprogress = event => { if (event.lengthComputable) setUploadProgress({ name: file.name, percent: Math.round(event.loaded / event.total * 100) }) }
        request.onerror = () => reject(new Error('Upload failed'))
        request.onload = () => {
          try { const data = JSON.parse(request.responseText); if (request.status >= 400) throw new Error(data.error); resolve(data) } catch (err) { reject(err) }
        }
        request.send(file)
      })
      const addFiles = async (list, glossary = false) => {
        setBusy(true)
        try {
          for (const file of Array.from(list || [])) {
            const result = await uploadOne(file)
            if (glossary) {
              setGlossaries(old => [...old, result])
              setValues(old => ({ ...old, glossaryIds: [...(old.glossaryIds || []), result.id] }))
            } else {
              setFiles(old => [...old, result]); setPreviewId(result.id)
            }
          }
        } finally { setBusy(false); setUploadProgress(null) }
      }
      const addLink = async () => {
        setBusy(true)
        try { const result = await api('links', 'POST', { url: link }); setFiles(old => [...old, result]); setPreviewId(result.id); setLink('') }
        finally { setBusy(false) }
      }
      const startJob = async () => {
        if (!files.length || !values.model) throw new Error(t('Select files and a model first'))
        setBusy(true)
        try { await api('jobs', 'POST', { fileIds: files.map(f => f.id), values }); setStatus(await api('status')) }
        finally { setBusy(false) }
      }
      const cancelJob = id => action(async () => { await api(`jobs/${id}/cancel`, 'POST'); setStatus(await api('status')) })
      const deleteHistory = input => action(async () => {
        setHistoryDeleting(true)
        try {
          const result = await api('jobs', 'DELETE', input)
          const removed = new Set(result.removedFileIds || [])
          setStatus(result)
          setFiles(old => old.filter(file => !removed.has(file.id)))
          setGlossaries(old => old.filter(file => !removed.has(file.id)))
          if (removed.has(previewId)) { setPreviewId(''); setPreviewError('') }
          setSelectedJobs(old => old.filter(id => result.jobs.some(job => job.id === id)))
        } finally { setHistoryDeleting(false) }
      })
      const clearJob = id => deleteHistory({ ids: [id] })
      const deletableJobs = status.jobs.filter(job => !['queued', 'running', 'cancelling'].includes(job.status))
      const selectedJobIds = selectedJobs.filter(id => deletableJobs.some(job => job.id === id))
      const showGlossary = id => action(async () => setGlossaryView(await api(`files/${id}/glossary`)))
      const environmentAction = fn => action(async () => { await fn(); setStatus(await api('status')) })
      const saveEnvironment = async () => {
        if (envSaving.current) return
        envSaving.current = true; setEnvSaveState('saving'); setMessage('')
        try {
          const saved = await api('environment', 'PUT', { mode: envMode, customPath: envPath, indexUrl: envIndex })
          setStatus(old => ({ ...old, phase: 'ready', error: null, environment: saved }))
          setEnvSaveState('saved')
        } catch (error) { setEnvSaveState('failed'); setMessage(error.message) }
        finally { envSaving.current = false }
      }
      const environment = status.environment
      const environmentPanel = h('div', null,
        h('section', { className: 'pz-card' }, h('h3', null, 'Python 环境'),
          h('p', null, '首次使用请选择“一键安装”。已有 Python、虚拟环境或 Conda 的用户可以使用自定义路径。'),
          h('div', { className: 'pz-row spread' }, h('span', { className: 'pz-pill' }, environment?.system?.label || '正在识别系统'),
            h('span', { role: 'status' }, environment?.health?.ok ? '当前环境可用' : '当前环境需要配置')),
          h('p', { className: 'pz-hint' }, '当前解释器：', environment?.python || '未配置'),
          h('p', { className: 'pz-hint' }, '兼容 Python 3.10–3.13，自动安装使用 Python 3.13；内置引擎 2.10.2。'),
          environment?.health && h('ul', null, environment.health.issues?.map((issue, i) => h('li', { key: i }, issue)))),
        h('section', { className: 'pz-card' }, h('h3', null, '安装与自定义'),
          h('div', { className: 'pz-row pz-env-modes', style: { marginBottom: 14 } },
            h('label', { className: 'pz-env-mode' }, h('input', { type: 'radio', name: 'pdfzh-env-mode', value: 'managed', checked: envMode === 'managed', disabled: environment?.busy || envSaveState === 'saving',
              onChange: () => { setEnvMode('managed'); setEnvCheck(null) } }), h('span', null, '一键安装')),
            h('label', { className: 'pz-env-mode' }, h('input', { type: 'radio', name: 'pdfzh-env-mode', value: 'custom', checked: envMode === 'custom', disabled: environment?.busy || envSaveState === 'saving',
              onChange: () => { setEnvMode('custom'); setEnvCheck(null) } }), h('span', null, '自定义环境'))),
          envMode === 'managed' ? h('div', null,
            h('p', null, '自动按本机系统与架构下载 Python，在插件目录内创建专用环境并安装依赖，删除插件目录时会一并删除。无需管理员权限，不修改系统 PATH。重装会先删除整个旧虚拟环境，再在固定的 venvs 目录创建；失败后需要重新安装。'),
            h('p', { className: 'pz-hint' }, '环境目录：', environment?.directory),
            !environment?.system?.supported && h('p', { role: 'alert' }, '此系统暂不支持自动安装，请使用自定义环境。')) :
            h('label', { className: 'pz-field' }, h('span', { className: 'pz-label' }, 'Python 解释器绝对路径'),
              h('input', { 'data-field': 'environmentPython', value: envPath, disabled: environment?.busy || envSaveState === 'saving', placeholder: environment?.system?.platform === 'win32' ? 'C:\\路径\\venv\\Scripts\\python.exe' : '/path/to/venv/bin/python',
                onChange: e => { setEnvPath(e.target.value); setEnvCheck(null) } }),
              h('span', { className: 'pz-hint' }, '填写 python.exe 或 bin/python 的完整路径；修改依赖前请确认这是你希望使用的环境。')),
          h('label', { className: 'pz-field', style: { marginTop: 14 } }, h('span', { className: 'pz-label' }, '依赖下载源'),
            h('select', { value: ['https://pypi.org/simple', 'https://pypi.tuna.tsinghua.edu.cn/simple'].includes(envIndex) ? envIndex : 'custom', disabled: environment?.busy || envSaveState === 'saving',
              onChange: e => setEnvIndex(e.target.value === 'custom' ? '' : e.target.value) },
              h('option', { value: 'https://pypi.org/simple' }, 'PyPI 官方源'), h('option', { value: 'https://pypi.tuna.tsinghua.edu.cn/simple' }, '清华镜像源'), h('option', { value: 'custom' }, '自定义 HTTPS 地址')),
            !['https://pypi.org/simple', 'https://pypi.tuna.tsinghua.edu.cn/simple'].includes(envIndex) && h('input', { value: envIndex, disabled: environment?.busy || envSaveState === 'saving', placeholder: 'https://…/simple', onChange: e => setEnvIndex(e.target.value) })),
          h('div', { className: 'pz-row', style: { marginTop: 14 } },
            h('button', { className: 'primary', disabled: environment?.busy || envSaveState === 'saving' || (envMode === 'managed' && !environment?.system?.supported) || (envMode === 'custom' && !envPath),
              onClick: environmentAction(() => api('environment/install', 'POST', { mode: envMode, customPath: envPath, indexUrl: envIndex })) },
              envMode === 'managed' ? '一键安装 / 重建环境' : '安装 / 修复依赖并使用'),
            h('button', { disabled: environment?.busy || envSaveState === 'saving' || (envMode === 'custom' && !envPath),
              onClick: environmentAction(async () => setEnvCheck(await api('environment/check', 'POST', { python: envMode === 'custom' ? envPath : environment?.config?.managedPython }))) }, '检测环境'),
            h('button', { disabled: environment?.busy || envSaveState === 'saving' || (envMode === 'custom' ? !envPath : !environment?.config?.managedPython),
              'aria-busy': envSaveState === 'saving', onClick: saveEnvironment }, envSaveState === 'saving' ? '正在保存…' : '保存并使用此环境'),
            h('span', { role: 'status', 'aria-live': 'polite' }, envSaveState === 'saving' ? '正在保存并检查环境…' : envSaveState === 'saved' ? '保存成功，已使用此环境。' : envSaveState === 'failed' ? '保存失败，请重试。' : '')),
          envCheck && h('div', { role: 'status', style: { marginTop: 14 } }, h('strong', null, envCheck.ok ? '检测通过' : '检测未通过'),
            envCheck.version && h('p', null, 'Python ', envCheck.version), h('ul', null, envCheck.issues?.map((issue, i) => h('li', { key: i }, issue))))),
        environment?.operation?.phase !== 'idle' && h('section', { className: 'pz-card' }, h('h3', null, '安装进度'),
          h('p', { role: 'status' }, environment?.operation?.stage), h('progress', { className: 'pz-progress', value: environment?.operation?.progress || 0, max: 1 }),
          environment?.operation?.error && h('p', { role: 'alert' }, '安装未完成，可检查网络或下载源后重试；详细原因见日志。'),
          environment?.busy && h('button', { onClick: environmentAction(() => api('environment/cancel', 'POST')) }, '取消安装'),
          environment?.operation?.logs && h('details', null, h('summary', null, '查看安装日志'), h('pre', { className: 'pz-log', tabIndex: 0 }, environment.operation.logs))),
        environment?.health?.packages && h('details', { className: 'pz-card' }, h('summary', null, '依赖版本'),
          h('table', null, h('tbody', null, Object.entries(environment.health.packages).map(([name, version]) => h('tr', { key: name }, h('td', null, name), h('td', null, version || '未安装')))))))
      const optionsFor = field => {
        if (field.model) return [...(field.follow ? [[t('Follow main translation engine'), '']] : [[t('Choose a Harness model'), '']]), ...models.map(m => [m.name || m.id, m.id])]
        if (field.language) return schema.languages.filter(x => field.id === 'lang_in' || x[1] !== 'auto')
        return field.choices || []
      }
      const fieldControl = field => {
        if (field.when && values[field.when[0]] !== field.when[1]) return null
        const disabled = Boolean((field.enabledBy && !values[field.enabledBy]) || (field.disabledBy && values[field.disabledBy]))
        const id = 'pdfzh-' + field.id, value = values[field.id] ?? field.default
        const props = { id, disabled, 'data-field': field.id }
        let input
        if (field.type === 'checkbox') input = h('input', { ...props, type: 'checkbox', checked: Boolean(value), onChange: e => change(field.id, e.target.checked) })
        else if (field.type === 'select') {
          const choices = optionsFor(field)
          if (field.model && value && !choices.some(c => c[1] === value)) choices.push([value + ' (' + t('No models available') + ')', value])
          const option = c => {
            const [label, key] = Array.isArray(c) ? c : [c, c]
            return h('option', { value: key, key }, t(label))
          }
          let options = choices.map(option)
          if (field.model) {
            const groups = new Map()
            for (const model of models) {
              if (!groups.has(model.provider)) groups.set(model.provider, { label: model.providerName || model.provider, options: [] })
              groups.get(model.provider).options.push(option([model.name || model.id, model.id]))
            }
            options = [option(choices[0]), ...[...groups].map(([key, group]) => h('optgroup', { key, label: group.label }, group.options)),
              ...choices.filter(c => c[1] && !models.some(m => m.id === c[1])).map(option)]
          }
          input = h('select', { ...props, value, onChange: e => change(field.id, e.target.value) }, options)
        } else if (field.type === 'textarea') input = h('textarea', { ...props, value, onChange: e => change(field.id, e.target.value) })
        else input = h('input', { ...props, type: field.type, value, min: field.min, max: field.max, step: field.step || 1,
          onChange: e => change(field.id, ['number', 'range'].includes(field.type) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value) })
        return h('label', { className: 'pz-field' + (field.type === 'checkbox' ? ' check' : ''), key: field.id, htmlFor: id, style: disabled ? { opacity: .55 } : undefined },
          field.type === 'checkbox' ? input : null,
          h('span', { className: 'pz-label' }, t(field.label), field.type === 'range' ? ` · ${value}` : ''),
          field.type !== 'checkbox' ? input : null,
          field.hint && h('span', { className: 'pz-hint' }, t(field.hint)))
      }
      const group = (id, title, collapsed = false) => h(collapsed ? 'details' : 'section', { className: 'pz-card', key: id },
        h(collapsed ? 'summary' : 'h3', null, t(title)), h('div', { className: 'pz-fields' }, schema.fields.filter(f => f.group === id).map(fieldControl)))
      const downloads = job => {
        const labels = { mono: 'Monolingual PDF', dual: 'Bilingual PDF' }
        return h('div', { className: 'pz-results' }, job.files.filter(file => ['mono', 'dual'].includes(file.kind)).map(file => h('div', { className: 'pz-row pz-result-group', key: file.id },
          h('a', { href: url(`files/${file.id}/download`), download: file.name }, t(labels[file.kind] || file.kind) + ' · ' + file.name),
          ['mono', 'dual'].includes(file.kind) && h('button', { onClick: () => { setPreviewId(file.id); setTab('main') } }, t('Preview')),
          file.kind === 'glossary' && h('button', { onClick: showGlossary(file.id) }, t('View glossary')))))
      }
      const jobCard = (job, selectable = false) => h('article', { className: 'pz-card pz-job', key: job.id },
        h('div', { className: 'pz-row spread' }, h('label', { className: 'pz-row' },
          selectable && h('input', { type: 'checkbox', 'aria-label': t('Select task') + ': ' + job.inputs.map(f => f.name).join(', '),
            checked: selectedJobIds.includes(job.id), disabled: historyDeleting || ['queued', 'running', 'cancelling'].includes(job.status),
            onChange: e => setSelectedJobs(old => e.target.checked ? [...new Set([...old, job.id])] : old.filter(id => id !== job.id)) }),
          h('strong', null, job.inputs.map(f => f.name).join(', '))),
          h('div', { className: 'pz-row' }, h('span', { className: 'pz-pill' }, t(job.status)),
            !['queued', 'running', 'cancelling'].includes(job.status) && h('button', { className: 'danger', disabled: historyDeleting, onClick: clearJob(job.id) }, t('Clear record')))),
        h('div', { className: 'pz-hint' }, job.model, ' · ', new Date(job.createdAt).toLocaleString()),
        h('progress', { className: 'pz-progress', max: 1, value: job.progress || 0 }),
        h('div', { className: 'pz-row spread' }, h('span', null, t(job.stage || job.status), job.currentFile ? ' · ' + job.currentFile : ''),
          ['queued', 'running'].includes(job.status) && h('button', { className: 'danger', onClick: cancelJob(job.id) }, t('Cancel'))),
        h('div', { className: 'pz-hint' }, Math.round((job.progress || 0) * 100), '%', job.parts ? ` · ${job.part}/${job.parts}` : '',
          job.stageTotal ? ` · ${job.stageCurrent}/${job.stageTotal}` : ''),
        job.error && h('p', { role: 'alert' }, job.error),
        job.failures?.map((f, i) => h('p', { key: i, role: 'alert' }, f.file + ': ' + f.error)),
        job.files.length ? downloads(job) : null,
        Object.keys(job.usage || {}).length ? h('div', { className: 'pz-hint' }, t('Token usage'), ': ', t('Total'), ' ', job.usage.total || 0, ' · ', t('Prompt'), ' ', job.usage.prompt || 0,
          ' · ', t('Completion'), ' ', job.usage.completion || 0) : null,
        job.logs && h('details', null, h('summary', null, t('View logs')), h('pre', { className: 'pz-log', tabIndex: 0 }, job.logs)))
      const allPdfs = [...files, ...status.jobs.flatMap(j => [...j.inputs, ...j.files.filter(f => ['mono', 'dual'].includes(f.kind))])]
      const uniquePdfs = [...new Map(allPdfs.map(f => [f.id, f])).values()]
      const currentJob = status.jobs.find(j => ['running', 'queued', 'cancelling'].includes(j.status)) || status.jobs[0]
      const preview = h('section', { className: 'pz-card' },
        h('h3', null, t('Document preview')),
        h('select', { value: previewId, 'aria-label': t('Choose a document'), onChange: e => setPreviewId(e.target.value) },
          h('option', { value: '' }, t('Choose a document')), uniquePdfs.map(f => h('option', { key: f.id, value: f.id }, (f.inputName ? f.inputName + ' / ' : '') + f.name))),
        h('div', { className: 'pz-pagination' },
          h('button', { disabled: page <= 1 || !previewId, onClick: () => setPage(p => p - 1), 'aria-label': t('Previous page') }, '‹'),
          h('span', null, t('Page')), h('input', { type: 'number', min: 1, max: pages, value: page, 'aria-label': t('Page'), onChange: e => setPage(Math.max(1, Math.min(pages, Number(e.target.value) || 1))) }),
          h('span', null, '/ ' + pages), h('button', { disabled: page >= pages || !previewId, onClick: () => setPage(p => p + 1), 'aria-label': t('Next page') }, '›'),
          h('select', { value: zoom, 'aria-label': t('Zoom'), style: { width: 86 }, onChange: e => setZoom(Number(e.target.value)) }, [50, 75, 100, 125, 150, 200].map(v => h('option', { key: v, value: v }, v + '%')))),
        h('div', { className: 'pz-preview' }, previewId && !previewError ? h('img', {
          src: url(`files/${previewId}/preview?page=${page}`), alt: `${t('Page')} ${page}`, style: { width: zoom + '%' },
          onError: () => setPreviewError(t('Preview unavailable')),
        }) : h('div', { className: 'pz-empty pz-muted' }, previewError || t('No PDF selected'))),
        previewId && h('a', { href: url(`files/${previewId}/download`), download: true }, t('Download source PDF')))

      return h('div', { className: 'pdfzh', ref: root }, h('style', null, style),
        h('header', { className: 'pz-top' }, h('span', { className: 'pz-title' }, t('PDF translation')), h('span', { className: 'pz-pill' }, 'DeepSeek Harness'),
          h('button', { onClick: action(async () => document.fullscreenElement ? document.exitFullscreen() : root.current.requestFullscreen()) }, t('Expand'))),
        h('nav', { className: 'pz-tabs' }, [['main', 'Translation'], ['settings', 'Settings'], ['environment', 'Environment'], ['history', 'History']].map(([id, label]) =>
          h('button', { key: id, className: tab === id ? 'active' : '', onClick: () => setTab(id) }, t(label), id === 'history' && status.jobs.length ? ` (${status.jobs.length})` : ''))),
        message && h('div', { className: 'pz-alert', role: 'alert' }, message, h('button', { onClick: () => setMessage(''), style: { float: 'right' }, 'aria-label': t('Close') }, '×')),
        !schema ? h('div', { className: 'pz-body' },
          h('p', { role: 'status' }, status.phase === 'failed' ? status.error : t('Preparing PDF engine…')),
          status.phase === 'failed' && h('button', { onClick: action(() => api('start', 'POST')) }, t('Retry'))) :
          h('div', { className: 'pz-body' },
            tab === 'environment' && environmentPanel,
            tab === 'main' && status.phase !== 'ready' && h('section', { className: 'pz-card' }, h('p', null, '请先配置 Python 环境，完成后即可翻译 PDF。'),
              h('button', { className: 'primary', onClick: () => setTab('environment') }, '前往环境设置')),
            tab === 'main' && status.phase === 'ready' && h('div', { className: 'pz-work' },
              h('div', null,
                h('section', { className: 'pz-card' }, h('h3', null, t('Source PDFs')),
                  h('div', { className: 'pz-row', style: { marginBottom: 10 } }, ['File', 'Link'].map(mode => h('button', { key: mode, className: sourceMode === mode ? 'primary' : '', onClick: () => setSourceMode(mode) }, t(mode)))),
                  h('input', { type: 'file', accept: '.pdf,application/pdf', multiple: true, ref: pdfInput, style: { display: 'none' }, onChange: action(async e => { const list = Array.from(e.target.files); e.target.value = ''; await addFiles(list) }) }),
                  sourceMode === 'File' ? h('div', { className: 'pz-drop', onDragOver: e => e.preventDefault(), onDrop: action(async e => { e.preventDefault(); if (!busy) await addFiles(e.dataTransfer.files) }) },
                    h('p', null, t('Drop PDFs here')), h('button', { disabled: busy, onClick: () => pdfInput.current.click() }, t('Add PDFs'))) :
                    h('div', { className: 'pz-row' }, h('input', { value: link, type: 'url', placeholder: 'https://…/document.pdf', 'aria-label': t('PDF URL'), onChange: e => setLink(e.target.value), style: { flex: 1 } }),
                      h('button', { disabled: busy || !link, onClick: action(addLink) }, t('Add URL'))),
                  uploadProgress && h('p', { role: 'status' }, t('Upload in progress'), ': ', uploadProgress.name, ' ', uploadProgress.percent, '%'),
                  files.map(file => h('div', { className: 'pz-file', key: file.id }, h('div', { className: 'pz-file-name' }, file.name, h('div', { className: 'pz-hint' }, (file.size / 1024 / 1024).toFixed(2), ' MB · ', file.pages, ' ', t('Page'))),
                    h('button', { onClick: () => setPreviewId(file.id) }, t('Preview')), h('button', { onClick: () => { setFiles(old => old.filter(f => f.id !== file.id)); if (previewId === file.id) setPreviewId('') } }, '×'))),
                  files.length ? h('button', { onClick: () => { setFiles([]); setPreviewId('') }, style: { marginTop: 10 } }, t('Clear files')) : null),
                h('section', { className: 'pz-card' }, h('h3', null, t('Translation Options')),
                  h('div', { className: 'pz-fields' }, schema.fields.filter(f => ['model', 'lang_in', 'lang_out'].includes(f.id)).map(fieldControl)),
                  h('div', { className: 'pz-row', style: { marginTop: 12 } }, h('button', { onClick: () => setValues(v => ({ ...v, lang_in: v.lang_out, lang_out: v.lang_in === 'auto' ? 'en' : v.lang_in })) }, t('Swap languages')),
                    h('button', { onClick: action(refreshModels) }, t('Refresh models'))), !models.length && h('p', { className: 'pz-hint' }, t('No models available'))),
                group('pages', 'Pages'),
                h('div', { className: 'pz-row' }, h('button', { className: 'primary', disabled: busy || !files.length || !values.model, onClick: action(startJob) }, busy ? t('Working…') : t('Translate'))),
                currentJob && jobCard(currentJob)),
              h('div', null, preview)),
            tab === 'settings' && h('div', null,
              group('general', 'Settings'), h('button', { onClick: action(refreshModels), style: { marginBottom: 14 } }, t('Refresh models')),
              group('output', 'Output settings'), group('rate', 'Translation rate limit'), group('term', 'Auto Term Extraction'),
              h('section', { className: 'pz-card' }, h('h3', null, t('Glossary files')),
                h('input', { type: 'file', accept: '.csv,text/csv', multiple: true, ref: csvInput, style: { display: 'none' }, onChange: action(async e => { const list = Array.from(e.target.files); e.target.value = ''; await addFiles(list, true) }) }),
                h('button', { disabled: busy, onClick: () => csvInput.current.click() }, t('Add CSV glossaries')),
                glossaries.map(file => h('div', { className: 'pz-file', key: file.id }, h('span', { className: 'pz-file-name' }, file.name),
                  h('button', { onClick: showGlossary(file.id) }, t('Preview')),
                  h('button', { onClick: () => { setGlossaries(old => old.filter(f => f.id !== file.id)); setValues(v => ({ ...v, glossaryIds: v.glossaryIds.filter(id => id !== file.id) })) } }, t('Remove'))))),
              group('advanced', 'Advanced Options', true),
              h('div', { className: 'pz-sticky' }, h('span', { className: 'pz-hint', role: 'status', style: { marginRight: 'auto' } }, t(saveState)),
                h('button', { onClick: action(loadSettings) }, t('Reload settings')),
                h('button', { onClick: () => { if (window.confirm(t('Reset settings?'))) { setValues({ ...schema.defaults, glossaryIds: [] }); setGlossaries([]) } } }, t('Reset to defaults')),
                h('button', { className: 'primary', onClick: action(async () => { await api('settings', 'PUT', valuesRef.current); setSaveState('Saved') }) }, t('Save Settings')))),
            tab === 'history' && h('div', null,
              h('div', { className: 'pz-row spread' },
                h('label', { className: 'pz-row' }, h('input', { type: 'checkbox', disabled: historyDeleting || !deletableJobs.length,
                  checked: deletableJobs.length > 0 && selectedJobIds.length === deletableJobs.length,
                  onChange: e => setSelectedJobs(e.target.checked ? deletableJobs.map(job => job.id) : []) }), t('Select all')),
                h('div', { className: 'pz-row' },
                  h('button', { className: 'danger', disabled: historyDeleting || !selectedJobIds.length,
                    onClick: deleteHistory({ ids: selectedJobIds }) }, t('Delete selected'), ' (', selectedJobIds.length, ')'),
                  h('button', { className: 'danger', disabled: historyDeleting || status.jobs.some(job => ['queued', 'running', 'cancelling'].includes(job.status)),
                    onClick: deleteHistory({ all: true }) }, t(historyDeleting ? 'Deleting…' : 'Clear all')))),
              h('p', { className: 'pz-hint' }, t('History cleanup hint')),
              status.jobs.length ? status.jobs.map(job => jobCard(job, true)) : h('p', { className: 'pz-muted' }, t('No jobs yet')))),
        glossaryView && h('section', { className: 'pz-modal', role: 'dialog', 'aria-label': t('Glossary') },
          h('div', { className: 'pz-row spread' }, h('h3', null, t('Glossary')), h('button', { onClick: () => setGlossaryView(null) }, t('Close'))),
          h('p', { className: 'pz-hint' }, t('Total rows'), ': ', glossaryView.total, ' · ', t('Showing first 500 rows')),
          h('div', { className: 'pz-table-scroll' }, h('table', null, h('tbody', null, glossaryView.rows.map((row, i) => h('tr', { key: i }, row.map((cell, j) => h(i === 0 ? 'th' : 'td', { key: j }, cell)))))))))
    }
    function apply(ctx) {
      const id = 'dsh-pdfzh/tab'
      const panelId = 'dsh-pdfzh'
      const PdfIcon = ({ size = 18 } = {}) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true },
        h('path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' }),
        h('path', { d: 'M14 3v6h6M8 13h8M8 17h5' }))
      // Global main panels exist on the home screen as well as in conversations.
      // Register the content before publishing its left navigation entry.
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: panelId, inject: () => ({}) }, PdfzhPanel)), 'pdfzh: global panel')
      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: panelId, label: () => 'PDF 翻译', order: 40,
      }, PdfIcon)), 'pdfzh: left navigation')
      ctx.effect(() => ctx.sidebarRightTabs.register({ id, kind: 'pdfzh', priority: 'builtin', title: () => 'PDF 翻译',
        guide: [{ id: 'pdfzh', order: 40, icon: PdfIcon, title: () => 'PDF 翻译', description: () => '原生 PDF 翻译面板，使用 Harness 模型，支持批量、术语表和全部高级选项。' }],
      }), 'pdfzh: native tab')
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, inject: () => ({}) }, PdfzhPanel)), 'pdfzh: native panel')
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: id, inject: () => ({}) }, () => 'PDF 翻译')), 'pdfzh: tab title')
    }
    return { apply, inject: ['slots', 'sidebarRightTabs'], PdfzhPanel }
  },
})
