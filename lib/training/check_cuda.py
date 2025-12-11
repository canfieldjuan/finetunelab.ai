"""
Check PyTorch CUDA compatibility for RTX 3090
"""
import torch

print("=" * 60)
print("PyTorch CUDA Configuration Check")
print("=" * 60)

print(f"\nPyTorch Version: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")
print(f"CUDA Version: {torch.version.cuda}")

if torch.cuda.is_available():
    print(f"\nGPU Device Count: {torch.cuda.device_count()}")
    print(f"Current Device: {torch.cuda.current_device()}")
    print(f"Device Name: {torch.cuda.get_device_name(0)}")
    
    # RTX 3090 specific info
    props = torch.cuda.get_device_properties(0)
    print(f"\nGPU Properties:")
    print(f"  - Total Memory: {props.total_memory / (1024**3):.2f} GB")
    print(f"  - Compute Capability: {props.major}.{props.minor}")
    print(f"  - Multi-Processors: {props.multi_processor_count}")
    
    # Check if compute capability matches RTX 3090 (8.6)
    if props.major == 8 and props.minor == 6:
        print("\n✅ RTX 3090 detected with correct compute capability (8.6)")
        print("✅ PyTorch is properly configured for Ampere architecture")
    else:
        print(f"\n⚠️  Unexpected compute capability: {props.major}.{props.minor}")
        print("   RTX 3090 should have 8.6")
else:
    print("\n❌ CUDA not available in PyTorch!")
    print("   You may need to reinstall PyTorch with CUDA support")

print("\n" + "=" * 60)
