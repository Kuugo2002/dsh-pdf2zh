"""Dependency diagnostics that work even when the environment has no packages."""
import importlib.metadata
import json
import sys
from pathlib import Path


def probe(source):
    issues = []
    compatible = (3, 10) <= sys.version_info[:2] < (3, 14)
    if not compatible:
        issues.append('需要 Python 3.10–3.13，推荐 3.13。')
    versions = {}
    for package in ('babeldoc', 'PyMuPDF', 'openai', 'pydantic', 'pydantic-settings', 'httpx', 'peewee', 'rich', 'chardet', 'tomlkit', 'packaging'):
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            versions[package] = None
            issues.append(f'缺少依赖：{package}')
    if versions.get('packaging'):
        from packaging.specifiers import SpecifierSet
        for package, constraint in {'babeldoc': '>=0.7.1,<0.8.0', 'PyMuPDF': '>=1.26.7,<2'}.items():
            if versions.get(package) and versions[package] not in SpecifierSet(constraint):
                issues.append(f'{package} 需要 {constraint}，当前为 {versions[package]}，请安装或修复依赖。')
    engine_source = None
    if compatible and not issues:
        try:
            sys.path.insert(0, str(Path(source).resolve()))
            import pymupdf
            import pdf2zh_next
            from pdf2zh_next.config.model import SettingsModel
            from pdf2zh_next.high_level import do_translate_async_stream
            engine_source = str(Path(pdf2zh_next.__file__).resolve())
            if not Path(engine_source).is_relative_to(Path(source).resolve()):
                issues.append('未加载插件内置的 PDF 引擎。')
        except Exception as exc:
            issues.append(f'PDF 引擎加载失败：{exc}')
    return {'ok': not issues, 'python': sys.executable, 'version': sys.version.split()[0],
            'compatible': compatible, 'packages': versions, 'issues': issues, 'engineSource': engine_source}


if __name__ == '__main__':
    print(json.dumps(probe(sys.argv[1]), ensure_ascii=False))
