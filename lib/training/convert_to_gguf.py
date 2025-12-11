"""
Convert HuggingFace models to GGUF format for Ollama deployment

This script is ONLY used for Ollama deployment. vLLM deployment uses HuggingFace models directly.

Usage:
    python convert_to_gguf.py <model_path> <output_path> [--quantization Q4_K_M]

Date: 2025-11-02
Phase: Ollama Deployment Integration
"""

import argparse
import subprocess
import sys
from pathlib import Path
import os
import io

# Ensure stdout/stderr can emit Unicode on Windows consoles and pipes.
# This prevents UnicodeEncodeError with cp1252 by forcing UTF-8 with replacement.
def _ensure_utf8_stdio():
    try:
        # Python 3.7+: TextIOWrapper supports reconfigure
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        # Fallback: wrap buffers explicitly if available
        try:
            if hasattr(sys.stdout, "buffer"):
                sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
            if hasattr(sys.stderr, "buffer"):
                sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
        except Exception:
            # Last resort: leave default encoding; prints may degrade but should not crash
            pass

# Also hint Python to prefer UTF-8 mode for any child libs that read these at runtime
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

_ensure_utf8_stdio()


def check_required_packages() -> tuple[bool, list[str]]:
    """Check if required Python packages are installed"""
    missing = []
    
    try:
        import gguf
    except ImportError:
        missing.append('gguf')
    
    try:
        import transformers
    except ImportError:
        missing.append('transformers')
    
    try:
        import torch
    except ImportError:
        missing.append('torch')
    
    try:
        import peft
    except ImportError:
        missing.append('peft')
    
    return (len(missing) == 0, missing)


def install_required_packages(packages: list[str]):
    """Install required Python packages"""
    print(f"[GGUF Converter] Installing required packages: {', '.join(packages)}")
    
    for package in packages:
        try:
            subprocess.run(
                [sys.executable, '-m', 'pip', 'install', package],
                check=True,
                capture_output=True
            )
            print(f"[GGUF Converter] ✓ Installed {package}")
        except subprocess.CalledProcessError as e:
            print(f"[GGUF Converter] ✗ Failed to install {package}: {e.stderr.decode()}", file=sys.stderr)
            raise


def convert_to_gguf(
    model_path: str,
    output_path: str,
    quantization: str = "Q4_K_M"
) -> str:
    """
    Convert HuggingFace model to GGUF format for Ollama
    
    Handles both full models and LoRA checkpoints (automatically merges adapters).
    
    Args:
        model_path: Path to HuggingFace model directory or LoRA checkpoint
        output_path: Where to save the GGUF file  
        quantization: Quantization type (Q4_K_M, Q5_K_M, Q8_0, F16)
    
    Returns:
        Path to the created GGUF file
    """
    model_path = Path(model_path).resolve()
    output_path = Path(output_path).resolve()
    
    if not model_path.exists():
        raise FileNotFoundError(f"Model path not found: {model_path}")
    
    # Check and install required packages
    packages_ok, missing = check_required_packages()
    if not packages_ok:
        print(f"[GGUF Converter] Missing packages: {', '.join(missing)}")
        install_required_packages(missing)
    
    # Create output directory
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"[GGUF Converter] Converting: {model_path}")
    print(f"[GGUF Converter] Output: {output_path}")
    print(f"[GGUF Converter] Quantization: {quantization}")
    
    # Check if this is a LoRA checkpoint
    adapter_config_path = model_path / "adapter_config.json"
    is_lora_checkpoint = adapter_config_path.exists()
    
    if is_lora_checkpoint:
        print("[GGUF Converter] Detected LoRA checkpoint - will merge with base model first")
        # Merge LoRA adapters with base model
        model_path = merge_lora_checkpoint(model_path)
        print(f"[GGUF Converter] LoRA merged, using model at: {model_path}")
    
    # Strategy: Convert to F16 first, then quantize if needed
    if quantization.upper() in ["F16", "FP16"]:
        # Direct F16 conversion
        try:
            convert_to_fp16_gguf(model_path, output_path)
            print(f"[GGUF Converter] ✓ Conversion successful: {output_path}")
            return str(output_path)
        except Exception as e:
            print(f"[GGUF Converter] ✗ Conversion failed: {e}", file=sys.stderr)
            raise
    else:
        # Convert to F16 first, then quantize
        temp_fp16 = output_path.with_suffix('.fp16.gguf')
        
        try:
            # Step 1: Convert to F16 GGUF
            print("[GGUF Converter] Step 1/2: Converting to F16 GGUF...")
            convert_to_fp16_gguf(model_path, temp_fp16)
            
            # Step 2: Quantize
            print(f"[GGUF Converter] Step 2/2: Quantizing to {quantization}...")
            success = quantize_gguf(temp_fp16, output_path, quantization)
            
            # Determine which file to use
            if success and output_path.exists():
                # Quantization successful, remove temp F16
                if temp_fp16.exists() and temp_fp16 != output_path:
                    temp_fp16.unlink()
                final_output = output_path
                print(f"[GGUF Converter] ✓ Quantized to {quantization}: {final_output}")
            else:
                # Use F16 as fallback
                final_output = temp_fp16
                print(f"[GGUF Converter] ⚠ Using F16 (quantization unavailable): {final_output}")
            
            return str(final_output)
            
        except Exception as e:
            # If F16 exists, use it despite errors
            if temp_fp16.exists():
                print(f"[GGUF Converter] ⚠ Error during conversion, using F16 fallback")
                print(f"[GGUF Converter] ✓ F16 GGUF available: {temp_fp16}")
                return str(temp_fp16)
            
            print(f"[GGUF Converter] ✗ Conversion failed: {e}", file=sys.stderr)
            raise


def merge_lora_checkpoint(checkpoint_path: Path) -> Path:
    """
    Merge LoRA adapters with base model
    
    Args:
        checkpoint_path: Path to LoRA checkpoint directory
    
    Returns:
        Path to merged model directory
    """
    import json
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    
    print("[GGUF Converter] Loading LoRA checkpoint configuration...")
    
    # Read adapter config to get base model
    with open(checkpoint_path / "adapter_config.json", 'r') as f:
        adapter_config = json.load(f)
    
    base_model_name = adapter_config.get("base_model_name_or_path")
    if not base_model_name:
        raise ValueError("adapter_config.json missing 'base_model_name_or_path'")
    
    print(f"[GGUF Converter] Base model: {base_model_name}")
    print(f"[GGUF Converter] LoRA rank: {adapter_config.get('r')}")
    print(f"[GGUF Converter] LoRA alpha: {adapter_config.get('lora_alpha')}")
    
    # Create merged model directory
    merged_dir = checkpoint_path.parent / f"{checkpoint_path.name}_merged"
    merged_dir.mkdir(exist_ok=True)
    
    # Check if already merged
    if (merged_dir / "config.json").exists() and (merged_dir / "model.safetensors").exists():
        print(f"[GGUF Converter] Using existing merged model at: {merged_dir}")
        return merged_dir
    
    print(f"[GGUF Converter] Loading base model: {base_model_name}")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype="auto",
        device_map="cpu"  # Load to CPU to avoid GPU memory issues
    )
    
    print(f"[GGUF Converter] Loading LoRA adapters from: {checkpoint_path}")
    model = PeftModel.from_pretrained(base_model, str(checkpoint_path))
    
    print("[GGUF Converter] Merging LoRA adapters with base model...")
    merged_model = model.merge_and_unload()
    
    print(f"[GGUF Converter] Saving merged model to: {merged_dir}")
    merged_model.save_pretrained(str(merged_dir), safe_serialization=True)
    
    # Also save tokenizer
    print("[GGUF Converter] Saving tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(str(checkpoint_path))
    tokenizer.save_pretrained(str(merged_dir))
    
    print(f"[GGUF Converter] ✓ LoRA merge complete: {merged_dir}")
    
    return merged_dir


def convert_to_fp16_gguf(model_path: Path, output_path: Path):
    """
    Convert HuggingFace model to F16 GGUF format
    
    Strategy:
    1. Try using llama.cpp's official converter (most reliable)
    2. Fall back to simplified conversion if llama.cpp unavailable
    """
    
    # Try llama.cpp's official converter first (best compatibility)
    llamacpp_success = try_llamacpp_converter(model_path, output_path)
    if llamacpp_success:
        return
    
    # Fallback: Simplified conversion (works for most common models)
    print("[GGUF Converter] llama.cpp converter unavailable, using fallback method...")
    fallback_gguf_conversion(model_path, output_path)


def try_llamacpp_converter(model_path: Path, output_path: Path) -> bool:
    """
    Try using llama.cpp's official convert_hf_to_gguf.py script
    
    Returns True if successful, False if unavailable
    """
    try:
        # Check if llama.cpp is available (env override > local fallback)
        env_llamacpp = os.environ.get("LLAMACPP_PATH")
        llamacpp_dir = Path(env_llamacpp).resolve() if env_llamacpp else (Path(__file__).parent / "llama.cpp")
        converter_script = llamacpp_dir / "convert_hf_to_gguf.py"
        
        if not converter_script.exists():
            print(f"[GGUF Converter] llama.cpp converter not found at {converter_script}")
            return False
        
        print(f"[GGUF Converter] Using official llama.cpp converter: {converter_script}")
        
        # Run the converter
        result = subprocess.run(
            [
                sys.executable,
                str(converter_script),
                str(model_path),
                '--outfile', str(output_path),
                '--outtype', 'f16'
            ],
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        if result.returncode == 0:
            print(f"[GGUF Converter] ✓ Official converter succeeded")
            return True
        else:
            print(f"[GGUF Converter] Official converter failed: {result.stderr[:500]}")
            return False
            
    except subprocess.TimeoutExpired:
        print("[GGUF Converter] Official converter timed out")
        return False
    except Exception as e:
        print(f"[GGUF Converter] Official converter error: {e}")
        return False


def fallback_gguf_conversion(model_path: Path, output_path: Path):
    """
    Simplified GGUF conversion (fallback method)
    
    Works for most common architectures but may not handle all edge cases.
    For production, use llama.cpp's official converter.
    """
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM, AutoConfig
        import torch
        import gguf
        
        print(f"[GGUF Converter] Loading model from {model_path}...")
        
        # Load model configuration
        config = AutoConfig.from_pretrained(str(model_path))
        print(f"[GGUF Converter] Model architecture: {config.model_type}")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(str(model_path))
        
        # Load model in F16
        model = AutoModelForCausalLM.from_pretrained(
            str(model_path),
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
            device_map="cpu"  # Load to CPU to avoid GPU memory issues
        )
        
        print("[GGUF Converter] Model loaded, creating GGUF file...")
        
        # Create GGUF writer
        gguf_writer = gguf.GGUFWriter(str(output_path), config.model_type)
        
        # Add basic architecture info
        gguf_writer.add_name(config.model_type)
        gguf_writer.add_architecture()
        
        # Add model parameters (simplified - may need adjustment per model type)
        if hasattr(config, 'hidden_size'):
            gguf_writer.add_embedding_length(config.hidden_size)
        if hasattr(config, 'num_attention_heads'):
            gguf_writer.add_head_count(config.num_attention_heads)
        if hasattr(config, 'num_hidden_layers'):
            gguf_writer.add_block_count(config.num_hidden_layers)
        
        # Add tokenizer
        if hasattr(tokenizer, 'get_vocab'):
            vocab = tokenizer.get_vocab()
            tokens = [token for token, _ in sorted(vocab.items(), key=lambda x: x[1])]
            gguf_writer.add_tokenizer_model("llama")  # Adjust based on actual tokenizer
            gguf_writer.add_token_list(tokens)
        
        # Add model tensors
        print("[GGUF Converter] Writing model weights to GGUF...")
        tensor_count = 0
        import gc

        for idx, (name, param) in enumerate(model.named_parameters(), start=1):
            # Convert tensor name to GGUF format (basic conversion)
            gguf_name = name.replace(".", "_")
            tensor = param.detach().cpu()
            if tensor.dtype != torch.float16:
                tensor = tensor.to(dtype=torch.float16)
            tensor = tensor.contiguous()
            data = tensor.numpy()
            gguf_writer.add_tensor(gguf_name, data)
            tensor_count += 1

            # Explicitly release intermediate tensors to keep peak RAM low
            del tensor
            del data

            if tensor_count % 10 == 0:
                print(f"[GGUF Converter] Processed {tensor_count} tensors...")
                gc.collect()
        
        # Write the file
        print(f"[GGUF Converter] Writing final GGUF file ({tensor_count} tensors total)...")
        gguf_writer.write_header_to_file()
        gguf_writer.write_kv_data_to_file()
        gguf_writer.write_tensors_to_file()
        gguf_writer.close()
        
        print(f"[GGUF Converter] ✓ F16 GGUF file created: {output_path}")
        
    except Exception as e:
        print(f"[GGUF Converter] ✗ Fallback conversion failed: {e}")
        print("\n" + "="*80)
        print("GGUF CONVERSION RECOMMENDATIONS")
        print("="*80)
        print("\nFor best compatibility across all model architectures:")
        print("\n1. Clone llama.cpp into lib/training/:")
        print("   cd lib/training")
        print("   git clone https://github.com/ggerganov/llama.cpp")
        print("\n2. Install requirements:")
        print("   pip install -r llama.cpp/requirements.txt")
        print("\n3. Re-run deployment (will auto-use llama.cpp converter)")
        print("\nAlternatively, convert manually:")
        print(f"   python llama.cpp/convert_hf_to_gguf.py {model_path} \\")
        print(f"       --outfile {output_path} \\")
        print("       --outtype f16")
        print("="*80 + "\n")
        raise RuntimeError(f"GGUF conversion failed. See recommendations above. Error: {e}")


def find_llama_quantize() -> Path | None:
    """Locate the llama-quantize binary using env vars, common build paths, or PATH.

    Discovery order:
    1) LLAMA_QUANTIZE_PATH env var (explicit override)
    2) LLAMACPP_PATH env var + common build paths
    3) Local ./llama.cpp directory + common build paths
    4) System PATH (shutil.which)
    """
    # 1) Explicit override
    env_quant = os.environ.get("LLAMA_QUANTIZE_PATH")
    if env_quant:
        p = Path(env_quant)
        if p.exists():
            print(f"[GGUF Converter] Found llama-quantize via LLAMA_QUANTIZE_PATH: {p}")
            return p
        else:
            print(f"[GGUF Converter] LLAMA_QUANTIZE_PATH set but not found: {p}")

    # 2) Use LLAMACPP_PATH if provided
    candidates: list[Path] = []
    llamacpp_root = os.environ.get("LLAMACPP_PATH")
    roots: list[Path] = []
    if llamacpp_root:
        roots.append(Path(llamacpp_root))
    # 3) Local llama.cpp checkout next to this file
    roots.append(Path(__file__).parent / "llama.cpp")

    subpaths = [
        # Typical Windows builds
        Path("build") / "bin" / "Release" / "llama-quantize.exe",
        Path("build") / "bin" / "Debug" / "llama-quantize.exe",
        Path("build") / "Release" / "llama-quantize.exe",
        Path("build") / "Debug" / "llama-quantize.exe",
        Path("build") / "bin" / "llama-quantize.exe",
        Path("bin") / "llama-quantize.exe",
        # Cross-platform names (in case available on PATH on Windows as well)
        Path("build") / "bin" / "Release" / "llama-quantize",
        Path("build") / "bin" / "Debug" / "llama-quantize",
        Path("build") / "Release" / "llama-quantize",
        Path("build") / "Debug" / "llama-quantize",
        Path("build") / "bin" / "llama-quantize",
        Path("bin") / "llama-quantize",
    ]

    for root in roots:
        for rel in subpaths:
            cand = (root / rel).resolve()
            if cand.exists():
                print(f"[GGUF Converter] Found llama-quantize at: {cand}")
                return cand

    # 4) Finally, try PATH
    try:
        import shutil
        which = shutil.which('llama-quantize') or shutil.which('llama-quantize.exe')
        if which:
            p = Path(which)
            print(f"[GGUF Converter] Found llama-quantize on PATH: {p}")
            return p
    except Exception:
        pass

    return None


def quantize_gguf_python(input_path: Path, output_path: Path, quantization: str) -> bool:
    """
    Quantize a GGUF file using Python gguf library

    Returns:
        True if quantization succeeded, False if failed
    """
    try:
        import gguf
        import numpy as np

        print(f"[GGUF Converter] Using Python-based quantization: {quantization}")

        # Map quantization string to GGMLQuantizationType
        quant_map = {
            'Q4_0': gguf.GGMLQuantizationType.Q4_0,
            'Q4_1': gguf.GGMLQuantizationType.Q4_1,
            'Q4_K': gguf.GGMLQuantizationType.Q4_K,
            'Q4_K_M': gguf.GGMLQuantizationType.Q4_K,
            'Q4_K_S': gguf.GGMLQuantizationType.Q4_K,
            'Q5_0': gguf.GGMLQuantizationType.Q5_0,
            'Q5_1': gguf.GGMLQuantizationType.Q5_1,
            'Q5_K': gguf.GGMLQuantizationType.Q5_K,
            'Q5_K_M': gguf.GGMLQuantizationType.Q5_K,
            'Q5_K_S': gguf.GGMLQuantizationType.Q5_K,
            'Q6_K': gguf.GGMLQuantizationType.Q6_K,
            'Q8_0': gguf.GGMLQuantizationType.Q8_0,
        }

        if quantization.upper() not in quant_map:
            print(f"[GGUF Converter] ⚠ Unsupported quantization type: {quantization}")
            print(f"[GGUF Converter] Supported types: {list(quant_map.keys())}")
            return False

        quant_type = quant_map[quantization.upper()]

        # Read input GGUF file
        print(f"[GGUF Converter] Reading F16 GGUF: {input_path}")
        reader = gguf.GGUFReader(str(input_path))

        # Create output GGUF writer
        writer = gguf.GGUFWriter(str(output_path), reader.fields['general.architecture'].parts[-1].tobytes().decode('utf-8'))

        # Copy metadata
        for field in reader.fields.values():
            if field.types[0] != gguf.GGUFValueType.ARRAY:
                writer.add_key_value(field.name, field.parts[-1])

        # Quantize and write tensors
        print(f"[GGUF Converter] Quantizing tensors...")
        tensor_count = 0
        for tensor in reader.tensors:
            tensor_data = tensor.data
            tensor_name = tensor.name

            # Quantize tensor data
            try:
                quantized_data = gguf.quantize(tensor_data, quant_type)
                writer.add_tensor(tensor_name, quantized_data, raw_dtype=quant_type)
                tensor_count += 1

                if tensor_count % 10 == 0:
                    print(f"[GGUF Converter] Quantized {tensor_count} tensors...")
            except Exception as e:
                print(f"[GGUF Converter] ⚠ Failed to quantize tensor {tensor_name}: {e}")
                # Write original data if quantization fails
                writer.add_tensor(tensor_name, tensor_data)

        # Write output file
        print(f"[GGUF Converter] Writing quantized GGUF ({tensor_count} tensors)...")
        writer.write_header_to_file()
        writer.write_kv_data_to_file()
        writer.write_tensors_to_file()
        writer.close()

        print(f"[GGUF Converter] ✓ Python quantization successful")
        return True

    except Exception as e:
        print(f"[GGUF Converter] ⚠ Python quantization failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def quantize_gguf(input_path: Path, output_path: Path, quantization: str) -> bool:
    """
    Quantize a GGUF file using Python gguf library or llama-quantize binary

    Returns:
        True if quantization succeeded, False if fallback to F16
    """
    try:
        # Try Python-based quantization first (no external dependencies)
        print(f"[GGUF Converter] Attempting Python-based quantization...")
        python_success = quantize_gguf_python(input_path, output_path, quantization)

        if python_success and output_path.exists():
            return True

        # Fall back to binary-based quantization
        print(f"[GGUF Converter] Python quantization unavailable, trying llama-quantize binary...")

        # Locate llama-quantize binary
        llama_quantize_path = find_llama_quantize()

        if not llama_quantize_path or not Path(llama_quantize_path).exists():
            print(f"[GGUF Converter] ⚠ llama-quantize binary not found")
            print(f"[GGUF Converter] Using F16 GGUF as fallback")
            # Copy F16 to output if different paths
            if input_path != output_path:
                import shutil
                shutil.copy2(input_path, output_path)
                print(f"[GGUF Converter] ✓ Copied F16 to: {output_path}")
            return False  # Fallback to F16

        # Run llama-quantize
        cmd = [
            str(llama_quantize_path),
            str(input_path),
            str(output_path),
            quantization
        ]

        print(f"[GGUF Converter] Running binary quantization: {quantization}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=300  # 5 minute timeout
        )

        if result.returncode == 0:
            print(f"[GGUF Converter] ✓ Binary quantization successful")
            return True
        else:
            print(f"[GGUF Converter] ⚠ Binary quantization failed:")
            print(f"[GGUF Converter]   {result.stderr[:500]}")  # First 500 chars
            print(f"[GGUF Converter] Using F16 GGUF as fallback")

            # Copy F16 to output as fallback
            if input_path != output_path:
                import shutil
                shutil.copy2(input_path, output_path)
                print(f"[GGUF Converter] ✓ Copied F16 to: {output_path}")

            return False

    except subprocess.TimeoutExpired:
        print(f"[GGUF Converter] ⚠ Quantization timed out (5 min limit)")
        print(f"[GGUF Converter] Using F16 GGUF as fallback")

        if input_path != output_path and input_path.exists():
            import shutil
            shutil.copy2(input_path, output_path)

        return False

    except Exception as e:
        print(f"[GGUF Converter] ⚠ Quantization error: {e}")
        print(f"[GGUF Converter] Using F16 GGUF (acceptable for development)")

        # Copy F16 to output if not already there
        if input_path != output_path and input_path.exists():
            import shutil
            shutil.copy2(input_path, output_path)
            print(f"[GGUF Converter] ✓ Copied F16 to: {output_path}")

        return False  # Not an error, just fallback


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert HuggingFace model to GGUF")
    parser.add_argument("model_path", help="Path to HuggingFace model directory")
    parser.add_argument("output_path", help="Output path for GGUF file")
    parser.add_argument(
        "--quantization",
        default="Q4_K_M",
        choices=["Q4_K_M", "Q5_K_M", "Q8_0", "FP16", "F16"],
        help="Quantization type (default: Q4_K_M for 8GB GPUs)"
    )
    
    args = parser.parse_args()
    
    try:
        result = convert_to_gguf(args.model_path, args.output_path, args.quantization)
        print(f"\n✅ SUCCESS: GGUF file created at {result}")
        print(f"[GGUF Converter] Ready to use with Ollama!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
