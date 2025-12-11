#!/usr/bin/env python3
"""
Analyze all FineTune Lab documentation files
"""

from pathlib import Path
import re

def analyze_document(file_path: Path):
    """Analyze structure of a markdown document"""
    content = file_path.read_text(encoding='utf-8')
    lines = content.split('\n')

    # Count headers by level
    headers = {
        'h1': [],
        'h2': [],
        'h3': []
    }

    for line in lines:
        if line.startswith('# ') and not line.startswith('## '):
            headers['h1'].append(line.strip('# ').strip())
        elif line.startswith('## ') and not line.startswith('### '):
            headers['h2'].append(line.strip('# ').strip())
        elif line.startswith('### '):
            headers['h3'].append(line.strip('# ').strip())

    return {
        'file': file_path.name,
        'lines': len(lines),
        'size': file_path.stat().st_size,
        'h1_count': len(headers['h1']),
        'h2_count': len(headers['h2']),
        'h3_count': len(headers['h3']),
        'h2_sections': headers['h2'][:10],  # First 10 H2s
        'h3_sections': headers['h3'][:15]   # First 15 H3s
    }

def main():
    docs_dir = Path("/home/juan-canfield/Desktop/web-ui-docs/finetune-lab")

    print("="*80)
    print("FINETUNE LAB DOCUMENTATION ANALYSIS")
    print("="*80)
    print()

    docs = sorted(docs_dir.glob("*.md"))
    total_lines = 0
    total_sections = 0

    for doc in docs:
        analysis = analyze_document(doc)
        total_lines += analysis['lines']
        total_sections += analysis['h2_count'] + analysis['h3_count']

        print(f"📄 {analysis['file']}")
        print(f"   Lines: {analysis['lines']:,} | Size: {analysis['size']:,} bytes")
        print(f"   Headers: H1={analysis['h1_count']}, H2={analysis['h2_count']}, H3={analysis['h3_count']}")

        if analysis['h2_sections']:
            print(f"   Main sections (H2):")
            for section in analysis['h2_sections']:
                print(f"     • {section}")

        print()

    print("="*80)
    print(f"📊 TOTAL: {len(docs)} documents, {total_lines:,} lines, ~{total_sections} sections")
    print(f"📦 Estimated chunks: {total_sections // 2} - {total_sections}")
    print(f"📈 Estimated training examples: {total_sections * 15} - {total_sections * 25}")
    print("="*80)

if __name__ == "__main__":
    main()
