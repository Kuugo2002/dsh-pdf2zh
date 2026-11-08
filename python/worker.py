"""PDF engine worker. No GUI server, Gradio, browser state, or UI callbacks."""
import argparse
import asyncio
import csv
import json
import io
import re
import sys
from pathlib import Path


def emit(event):
    print('PDFZH:' + json.dumps(event, ensure_ascii=False, default=str), flush=True)


def clean_pdf_name(name):
    cleaned = re.sub(r'(?i)[._-]*(?:no[._-]?)?watermark(?:ed)?[._-]*', '.', name)
    cleaned = re.sub(r'\.{2,}', '.', cleaned).strip(' ._-')
    return cleaned if cleaned.lower().endswith('.pdf') and cleaned.lower() != 'pdf' else 'translated.pdf'


async def translate(path):
    # Imported only for translation; previews do not load model dependencies.
    from pdf2zh_next.config.model import SettingsModel
    from pdf2zh_next.high_level import do_translate_async_stream
    manifest = json.loads(Path(path).read_text(encoding='utf-8'))
    artifacts = []
    failures = []
    usage = {}
    inputs = manifest['inputs']
    for index, item in enumerate(inputs):
        try:
            settings_data = manifest['settings'].copy()
            settings_data['translation'] = dict(settings_data['translation'], output=str(Path(manifest['output']) / str(index + 1)))
            settings = SettingsModel.model_validate(settings_data)
            async for event in do_translate_async_stream(settings, Path(item['path'])):
                kind = event.get('type')
                if kind in ('progress_start', 'progress_update', 'progress_end'):
                    emit({'type': 'progress', 'file': item['name'], 'index': index, 'total': len(inputs),
                          'progress': (index + event.get('overall_progress', 0) / 100) / len(inputs),
                          'stage': event.get('stage', ''), 'current': event.get('stage_current'), 'stageTotal': event.get('stage_total'),
                          'part': event.get('part_index'), 'parts': event.get('total_parts')})
                elif kind == 'finish':
                    result = event['translate_result']
                    seen = set()
                    outputs = [
                        (getattr(result, 'no_watermark_mono_pdf_path', None) or getattr(result, 'mono_pdf_path', None), 'mono'),
                        (getattr(result, 'no_watermark_dual_pdf_path', None) or getattr(result, 'dual_pdf_path', None), 'dual'),
                        (getattr(result, 'auto_extracted_glossary_path', None), 'glossary'),
                    ]
                    for file, category in outputs:
                        if file and Path(file).is_file() and str(file) not in seen:
                            seen.add(str(file))
                            file = Path(file)
                            if category in ('mono', 'dual'):
                                renamed = file.with_name(clean_pdf_name(file.name))
                                suffix = 1
                                while renamed != file and renamed.exists():
                                    renamed = file.with_name(f'{Path(clean_pdf_name(file.name)).stem}-translated-{suffix}.pdf')
                                    suffix += 1
                                if renamed != file:
                                    file.rename(renamed)
                                    file = renamed
                            artifacts.append({'path': str(Path(file).resolve()), 'name': Path(file).name,
                                              'kind': category, 'inputName': item['name']})
                    for group, totals in event.get('token_usage', {}).items():
                        for key, value in totals.items():
                            if key in ('total', 'prompt', 'completion'):
                                usage[key] = usage.get(key, 0) + value
                    emit({'type': 'file-complete', 'file': item['name'], 'index': index, 'total': len(inputs), 'artifacts': artifacts, 'usage': usage})
                elif kind == 'error':
                    raise RuntimeError(str(event.get('error', 'Translation failed')))
        except Exception as exc:
            failures.append({'file': item['name'], 'error': str(exc)})
            emit({'type': 'file-error', **failures[-1]})
    emit({'type': 'complete', 'artifacts': artifacts, 'failures': failures, 'usage': usage})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['translate', 'inspect', 'render', 'glossary', 'engine-info'])
    parser.add_argument('path')
    parser.add_argument('--page', type=int, default=1)
    parser.add_argument('--source', default=str(Path(__file__).resolve().parent.parent / 'vendor' / 'PDFMathTranslate-next'))
    args = parser.parse_args()
    sys.path.insert(0, str(Path(args.source).resolve()))
    if args.operation == 'engine-info':
        import pdf2zh_next
        actual = Path(pdf2zh_next.__file__).resolve()
        if not actual.is_relative_to(Path(args.source).resolve()):
            raise RuntimeError(f'Cannot load bundled PDF engine: {args.source}')
        print(json.dumps({'source': str(actual)}))
    elif args.operation == 'translate':
        asyncio.run(translate(args.path))
    elif args.operation == 'glossary':
        import chardet
        content = Path(args.path).read_bytes()
        encoding = chardet.detect(content)['encoding'] or 'utf-8-sig'
        rows = list(csv.reader(io.StringIO(content.decode(encoding))))
        if not rows or not {'source', 'target'}.issubset(rows[0]):
            raise ValueError("Glossary CSV must contain 'source' and 'target' columns")
        print(json.dumps({'rows': rows[:501], 'total': max(0, len(rows) - 1)}, ensure_ascii=False))
    else:
        import pymupdf
        with pymupdf.open(args.path) as document:
            if args.operation == 'inspect':
                print(json.dumps({'pages': len(document)}))
            else:
                if not 1 <= args.page <= len(document):
                    raise ValueError('Page out of range')
                page = document[args.page - 1]
                scale = min(2, 1600 / max(page.rect.width, page.rect.height))
                sys.stdout.buffer.write(page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).tobytes('png'))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        emit({'type': 'error', 'error': str(exc)})
        sys.exit(1)
