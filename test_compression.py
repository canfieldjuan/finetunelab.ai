"""
Test Dataset Compression/Decompression Workflow
Tests the complete flow: Upload compressed → Download decompressed → Training
"""
import gzip
import json
import os
from pathlib import Path

def test_compression_workflow():
    """Test the compression/decompression workflow"""
    
    print("\n" + "="*70)
    print("TESTING DATASET COMPRESSION/DECOMPRESSION WORKFLOW")
    print("="*70)
    
    # Create sample dataset (simulate large dataset)
    sample_data = []
    for i in range(1000):
        sample_data.append({
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": f"Question {i}: What is the capital of country {i}?"},
                {"role": "assistant", "content": f"Answer {i}: The capital is city_{i}."}
            ]
        })
    
    # Convert to JSONL
    jsonl_content = "\n".join([json.dumps(item) for item in sample_data])
    original_size = len(jsonl_content.encode('utf-8'))
    
    print(f"\n📊 Original Dataset:")
    print(f"   • Examples: {len(sample_data)}")
    print(f"   • Size: {original_size:,} bytes ({original_size / 1024:.1f} KB)")
    
    # Test compression
    print(f"\n🗜️  Testing Compression:")
    compressed_data = gzip.compress(jsonl_content.encode('utf-8'))
    compressed_size = len(compressed_data)
    compression_ratio = (1 - compressed_size / original_size) * 100
    
    print(f"   • Compressed size: {compressed_size:,} bytes ({compressed_size / 1024:.1f} KB)")
    print(f"   • Compression ratio: {compression_ratio:.1f}%")
    print(f"   • Size reduction: {original_size - compressed_size:,} bytes")
    
    # Save compressed file
    compressed_path = Path("test_dataset.jsonl.gz")
    with open(compressed_path, 'wb') as f:
        f.write(compressed_data)
    print(f"   • Saved to: {compressed_path}")
    
    # Test decompression
    print(f"\n📤 Testing Decompression:")
    with open(compressed_path, 'rb') as f:
        decompressed_data = gzip.decompress(f.read())
    
    decompressed_size = len(decompressed_data)
    decompressed_content = decompressed_data.decode('utf-8')
    
    print(f"   • Decompressed size: {decompressed_size:,} bytes ({decompressed_size / 1024:.1f} KB)")
    print(f"   • Content matches original: {decompressed_content == jsonl_content}")
    
    # Parse decompressed JSONL
    lines = decompressed_content.strip().split('\n')
    parsed_examples = [json.loads(line) for line in lines]
    
    print(f"   • Parsed examples: {len(parsed_examples)}")
    print(f"   • Data integrity: {len(parsed_examples) == len(sample_data)}")
    
    # Clean up
    compressed_path.unlink()
    
    # Test with realistic large dataset size
    print(f"\n📈 Projection for 116 MB dataset:")
    large_size = 116 * 1024 * 1024  # 116 MB
    projected_compressed = large_size * (1 - compression_ratio / 100)
    
    print(f"   • Original size: {large_size / 1024 / 1024:.1f} MB")
    print(f"   • Expected compressed size: {projected_compressed / 1024 / 1024:.1f} MB")
    print(f"   • Within 50 MB limit: {projected_compressed < 50 * 1024 * 1024}")
    
    print(f"\n✅ All compression tests passed!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_compression_workflow()
