#!/usr/bin/env python3
"""
Chunk MONITORING_REALTIME.md by feature sections for Q&A generation
"""

import json
from pathlib import Path
from typing import List, Dict

def chunk_document(file_path: str) -> List[Dict[str, str]]:
    """Split document into logical chunks by major sections"""

    content = Path(file_path).read_text(encoding='utf-8')
    lines = content.split('\n')

    chunks = []
    current_chunk = []
    current_title = ""
    in_core_features = False

    for line in lines:
        # Detect major section headers
        if line.startswith('### ') and 'Core Features' in ''.join(lines[max(0, lines.index(line)-10):lines.index(line)]):
            in_core_features = True

        if line.startswith('### ') and in_core_features:
            # Save previous chunk if exists
            if current_chunk and current_title:
                chunks.append({
                    "title": current_title.strip('#').strip(),
                    "content": '\n'.join(current_chunk).strip()
                })

            # Start new chunk
            current_title = line
            current_chunk = [line]

        elif line.startswith('## ') and in_core_features and current_chunk:
            # End of core features section
            if current_chunk and current_title:
                chunks.append({
                    "title": current_title.strip('#').strip(),
                    "content": '\n'.join(current_chunk).strip()
                })
            in_core_features = False
            current_chunk = []
            current_title = ""

        elif in_core_features:
            current_chunk.append(line)

    # Add last chunk
    if current_chunk and current_title:
        chunks.append({
            "title": current_title.strip('#').strip(),
            "content": '\n'.join(current_chunk).strip()
        })

    return chunks

def main():
    doc_path = "/home/juan-canfield/Desktop/web-ui-docs/finetune-lab/MONITORING_REALTIME.md"

    print("="*80)
    print("CHUNKING MONITORING_REALTIME.md BY FEATURE SECTIONS")
    print("="*80)
    print()

    chunks = chunk_document(doc_path)

    print(f"✅ Created {len(chunks)} chunks:")
    print()

    for i, chunk in enumerate(chunks, 1):
        lines = chunk['content'].count('\n') + 1
        chars = len(chunk['content'])
        print(f"  {i}. {chunk['title']}")
        print(f"     Lines: {lines}, Characters: {chars:,}")

    print()

    # Save chunks
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/monitoring_chunks.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    print(f"📁 Saved to: {output_path}")
    print(f"📊 Total chunks: {len(chunks)}")
    print()

if __name__ == "__main__":
    main()
