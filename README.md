# dsh-pdfzh

DeepSeek Harness 原生 PDF 翻译插件。

使用 JavaScript / React 实现翻译面板，直接使用 Harness 中已配置的模型服务商。Python 负责 PDF 翻译、页面渲染和 CSV 解析，不启动或嵌入 Gradio 界面。翻译引擎 PDFMathTranslate-next 2.10.2 随插件提供。

## 主要功能

- PDF 文件选择、拖放、HTTP/HTTPS 链接导入和批量任务队列。
- 原文与译文预览，支持翻页、缩放，以及单语 / 双语 PDF 下载。
- 主翻译和术语提取可选择不同模型，支持并发、限速、超时和温度设置。
- 页面范围、语言互换、CSV 术语表、自动术语提取和自定义提示词。
- 公式与版面保护、字体设置、扫描检测、OCR 兼容及高级 PDF 输出选项。
- Python 自动安装、自定义环境检测、依赖修复、任务取消和历史记录。
- 设置保存、多语言界面、窄侧栏和全屏布局。

## 运行要求

| 项目 | 要求 |
| --- | --- |
| DeepSeek Harness | 符合 `^0.2.1-rc.5 || ^0.2.2-0` 的版本 |
| Node.js | 22.19.0 或更高版本；桌面版可使用其自带运行环境 |
| Python | 3.10–3.13，推荐 3.13；可由插件自动安装 |
| 模型服务 | 在 Harness 中配置可用的服务商与模型 |
| 网络 | 安装环境时需访问 GitHub 和 Python 包源；翻译时需访问所选模型服务及所需资源 |

自动环境提供 Windows、macOS、Linux 的 x64 / ARM64 安装逻辑。目前实际设备验证范围为 Windows x64。

## 安装

### 从源码打包

下载仓库源码后，在项目根目录执行：

```powershell
npm pack
```

打包完成后，通过 Harness 安装生成的安装包：

```powershell
$pluginPackage = Get-ChildItem -File -Filter 'dsh-pdfzh-*.tgz' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
dsh plugin --profile desktop add $pluginPackage.FullName
```

如果 `dsh` 未加入 PATH，请将命令中的 `dsh` 替换为本机 Harness 的 `dsh.cmd` 或对应可执行文件路径。

本项目没有前端编译步骤，也没有需要单独安装的 npm 运行依赖。React 由 Harness 提供；Python 依赖在插件的“环境”页安装。

### 首次使用

1. 打开 Harness 左侧的 **PDF 翻译**，或会话右侧工具面板中的同名入口。
2. 进入 **环境** 页，点击“一键安装”，或者选择已有 Python 解释器并检测、保存。
3. 在 Harness 中配置模型服务商，回到插件刷新并选择翻译模型。
4. 上传 PDF 或输入链接，调整语言及输出设置，提交翻译。
5. 在预览区域或任务记录中查看结果、下载单语或双语 PDF。

默认使用无水印输出，翻译和术语提取各使用 8 个并发请求。可根据模型服务限制调整。

## Python 环境

**自动环境**通过 uv 下载 Python 3.13、创建插件专用虚拟环境并安装依赖，支持查看日志、取消、失败重试及重建。安装工具的版本及 SHA256 固定，不修改系统 PATH 或全局 Python，无需管理员权限。

新安装的 Python、虚拟环境、uv 工具及安装缓存统一放在插件安装目录下的 `environment/` 中，卸载并删除插件目录时会一并删除。环境选择设置仍保存在数据目录中。旧版已安装的环境继续使用原路径，重新一键安装后使用插件内的新位置；旧目录中的环境保留，确认不再使用后可手动删除。

**自定义环境**支持已有 venv / Conda 环境。填写解释器绝对路径，检测通过后保存。“安装 / 修复依赖并使用”会修改所选环境的依赖，建议为插件使用独立环境。

运行依赖见 [`python/requirements.txt`](python/requirements.txt)。内置引擎要求 BabelDOC `>=0.7.1,<0.8.0`、PyMuPDF `>=1.26.7,<2`，不需要 Gradio 或 bitstring。旧环境检测不通过时，可在“环境”页修复。

依赖下载默认使用清华镜像，可切换为 PyPI 或自定义 HTTPS 包源。首次运行可能还需下载上游字体及模型资源。

安装环境期间不能提交翻译任务，有排队或运行任务时不能切换环境。重建自动环境会删除旧虚拟环境；若随后失败或取消，需要重新安装。自定义环境不会被自动删除。

## 配置

通常直接使用面板中的“环境”和“设置”页即可。默认安装入口由 [`cordis.patch.yml`](cordis.patch.yml) 定义。

需要覆盖配置时，在 Harness desktop profile 的 `cordis.patch.yml` 中配置对应插件：

```yaml
- id: pdfzh
  config:
    python: C:/path/to/venv/Scripts/python.exe
    timeoutMs: 3600000
```

macOS / Linux 的解释器路径可使用 `/path/to/venv/bin/python`。请替换为本机实际路径。

| 配置项 | 用途 |
| --- | --- |
| `python` | 已有 Python 解释器路径；“环境”页保存的选择优先 |
| `timeoutMs` | 翻译任务超时，默认 3600000 毫秒 |
| `stateDir` | 自定义数据目录 |
| `source` | 开发时覆盖翻译引擎源码目录，默认使用内置引擎 |

也可通过 `PDFZH_PYTHON`、`PDFZH_SOURCE` 提供解释器和引擎路径；同名插件配置优先。

模型 API Key 和服务地址在 Harness 服务商设置中管理。主翻译与术语模型分别路由到所选服务商。JSON 模式通过提示词约束输出，实际效果取决于模型能力。

## 数据与任务记录

默认数据目录为 `~/.dsh/dsh-pdf2zh/`；设置 `DSH_HOME` 时使用其下的 `dsh-pdf2zh/`，也可用 `stateDir` 覆盖。

| 路径 | 内容 |
| --- | --- |
| `state.json` | 界面偏好、上传文件登记和任务记录 |
| `files/` | 上传的 PDF 与 CSV |
| `jobs/` | 分任务输出及引擎请求信息 |
| `environment/settings.json` | 环境选择设置（Python、虚拟环境和安装缓存位于插件安装目录下的 `environment/`） |

结果和历史跨重启保留。清除任务记录仅移除记录，不删除文件，也不会停止运行中的任务。任务日志可在“查看日志”中展开。

升级时会迁移旧 `pdfzh-native` 数据目录中的设置、记录和文件，并保留旧目录作为备份。已有自定义 Python 环境继续使用原路径。BabelDOC 的字体、模型资源及翻译缓存沿用上游目录。

数据目录可能包含原文、译文及本机内部连接参数，请勿提交到公开仓库。使用自定义 `stateDir` 时，应同时将对应路径加入本地忽略规则。

## 源码结构

```text
lib/
  client.js               原生 React 面板
  schema.js               设置定义、校验与引擎参数映射
  index.js                文件接口、队列、历史、预览与下载
  environment.js          Python 环境安装、检测与切换
  data-directory.js       旧数据目录迁移
  gateway.js / protocol.js  Harness 模型网关与协议转换
  locales.json            界面字典和语言列表
python/
  worker.py               无 GUI 的 PDF 处理进程
  environment_probe.py    解释器与依赖检测
  requirements.txt        Python 运行依赖
vendor/PDFMathTranslate-next/
                          内置翻译引擎、许可证和上游版本记录
cordis.patch.yml           Harness 插件注册配置
```

浏览器接口位于 `/api/pdfzh/`，执行 Harness 浏览器信任检查。模型网关只监听本机回环地址，并校验任务令牌。取消任务或插件退出时，会终止对应 Python 进程树。

仓库已清除本地测试脚本、测试样本、测试环境、截图、引擎备份和旧安装包，并移除对应 npm 测试命令及开发依赖。构建产物、缓存、本地环境与运行数据由 `.gitignore` 排除。提交时保留 `package-lock.json` 和内置引擎源码。

## 常见问题

- **找不到模型**：先在 Harness 配置服务商，再回到插件刷新模型列表。
- **环境检测失败**：确认解释器属于 Python 3.10–3.13，展开日志查看缺失依赖，或使用独立环境重新安装。
- **自动安装失败**：检查 GitHub、所选 Python 包源及代理设置，然后重试。
- **翻译失败或输出不完整**：展开任务日志，检查模型限速、超时、PDF 扫描情况和输出选项；必要时先用少量页面验证。

## 许可与致谢

本项目采用 **AGPL-3.0**，见 [`LICENSE`](LICENSE) 和 [`NOTICE`](NOTICE)。

内置 [PDFMathTranslate-next](https://github.com/PDFMathTranslate-next/PDFMathTranslate-next) 2.10.2 引擎；上游仓库、提交及排除项记录在 [`UPSTREAM.json`](vendor/PDFMathTranslate-next/UPSTREAM.json)。保留上游许可证及作者信息，运行源码未修改，测试目录未随本项目提供。界面字典和语言列表来自上游；BabelDOC 等库作为 Python 运行依赖安装。
