"""
Quick test to verify llama-quantize integration
This tests that the binary can be found and executed
"""

from pathlib import Path
import subprocess
import sys

def test_quantize_binary():
    """Test that llama-quantize binary exists and works"""
    
    # Path should match convert_to_gguf.py
    script_dir = Path(__file__).parent
    quantize_path = script_dir / "llama.cpp" / "build" / "bin" / "Release" / "llama-quantize.exe"
    
    print(f"Script directory: {script_dir}")
    print(f"Quantize binary path: {quantize_path}")
    print(f"Binary exists: {quantize_path.exists()}")
    
    if not quantize_path.exists():
        print("❌ FAIL: llama-quantize.exe not found!")
        return False
    
    # Check file size
    size_mb = quantize_path.stat().st_size / (1024 * 1024)
    print(f"Binary size: {size_mb:.2f} MB")
    
    # Test execution
    try:
        result = subprocess.run(
            [str(quantize_path), "--help"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # --help returns exit code 1, which is normal
        if "Q4_K_M" in result.stdout:
            print("✅ SUCCESS: llama-quantize binary is functional!")
            print(f"Supported formats: Q4_K_M, Q5_K_M, Q8_0, F16, etc.")
            return True
        else:
            print("❌ FAIL: Binary exists but doesn't show expected output")
            print(f"stdout: {result.stdout[:200]}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ FAIL: Binary execution timed out")
        return False
    except Exception as e:
        print(f"❌ FAIL: Error running binary: {e}")
        return False

if __name__ == "__main__":
    success = test_quantize_binary()
    sys.exit(0 if success else 1)
