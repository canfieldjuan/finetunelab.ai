#!/usr/bin/env python3
"""
Chunk all FineTune Lab documentation for Atlas training
Intelligently splits by H2/H3 sections, merges small chunks
"""

import json
from pathlib import Path
from typing import List, Dict

def chunk_by_sections(content: str, file_name: str) -> List[Dict[str, str]]:
    """
    Chunk document by H2 and H3 sections
    Merge small chunks to maintain context
    """
    lines = content.split('\n')
    chunks = []
    current_chunk = []
    current_title = ""
    current_h2 = ""

    for i, line in enumerate(lines):
        # H2 section - major division
        if line.startswith('## ') and not line.startswith('### '):
            # Save previous chunk if meaningful
            if current_chunk and len('\n'.join(current_chunk)) > 100:
                chunks.append({
                    "title": current_title or current_h2 or "Introduction",
                    "h2_section": current_h2,
                    "content": '\n'.join(current_chunk).strip(),
                    "source_file": file_name
                })

            current_h2 = line.strip('#').strip()
            current_title = current_h2
            current_chunk = [line]

        # H3 section - subdivide if H2 is getting large
        elif line.startswith('### '):
            # If current chunk is large (>800 lines), split at H3
            if len(current_chunk) > 800:
                chunks.append({
                    "title": current_title,
                    "h2_section": current_h2,
                    "content": '\n'.join(current_chunk).strip(),
                    "source_file": file_name
                })
                current_chunk = []

            h3_title = line.strip('#').strip()
            current_title = f"{current_h2} - {h3_title}" if current_h2 else h3_title
            current_chunk.append(line)

        else:
            current_chunk.append(line)

    # Add final chunk
    if current_chunk and len('\n'.join(current_chunk)) > 100:
        chunks.append({
            "title": current_title or "Content",
            "h2_section": current_h2,
            "content": '\n'.join(current_chunk).strip(),
            "source_file": file_name
        })

    return chunks

def process_all_documents(docs_dir: Path) -> List[Dict]:
    """Process all markdown files in directory"""
    all_chunks = []

    for doc_path in sorted(docs_dir.glob("*.md")):
        # Skip MONITORING_REALTIME.md - already processed
        if doc_path.name == "MONITORING_REALTIME.md":
            print(f"⏭️  Skipping {doc_path.name} (already processed)")
            continue

        print(f"📄 Processing {doc_path.name}...")

        content = doc_path.read_text(encoding='utf-8')
        chunks = chunk_by_sections(content, doc_path.name)

        print(f"   ✅ Created {len(chunks)} chunks")

        for chunk in chunks:
            chunk['doc_id'] = f"{doc_path.stem}_{len(all_chunks):03d}"
            all_chunks.append(chunk)

    return all_chunks

def main():
    docs_dir = Path("/home/juan-canfield/Desktop/web-ui-docs/finetune-lab")
    output_dir = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation")

    print("="*80)
    print("CHUNKING ALL FINETUNE LAB DOCUMENTATION")
    print("="*80)
    print()

    all_chunks = process_all_documents(docs_dir)

    print()
    print("="*80)
    print("📊 CHUNKING SUMMARY")
    print("="*80)

    # Group by source file
    by_file = {}
    for chunk in all_chunks:
        file_name = chunk['source_file']
        if file_name not in by_file:
            by_file[file_name] = []
        by_file[file_name].append(chunk)

    for file_name, chunks in sorted(by_file.items()):
        total_chars = sum(len(c['content']) for c in chunks)
        print(f"{file_name}: {len(chunks)} chunks ({total_chars:,} chars)")

    print()
    print(f"📦 Total chunks: {len(all_chunks)}")
    print(f"📈 Estimated training examples: {len(all_chunks) * 15} - {len(all_chunks) * 20}")
    print()

    # Save chunks
    output_path = output_dir / "all_docs_chunks.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()

if __name__ == "__main__":
    main()
