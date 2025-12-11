"""
Check trainer_venv dependencies and cloud SDKs installation status
"""

import sys
from importlib.metadata import version, PackageNotFoundError

def check_package(name: str, display_name: str = None) -> None:
    """Check if a package is installed and print version"""
    display = display_name or name
    try:
        ver = version(name)
        print(f"✓ {display}: {ver}")
        return True
    except PackageNotFoundError:
        print(f"✗ {display}: NOT INSTALLED")
        return False

def main():
    print("=" * 60)
    print("Training Environment Package Status")
    print("=" * 60)
    
    print("\n📦 Core Deep Learning:")
    check_package("torch", "PyTorch")
    check_package("transformers", "Transformers")
    check_package("datasets", "Datasets")
    
    print("\n🔧 Fine-tuning & Optimization:")
    check_package("peft", "PEFT (LoRA)")
    check_package("trl", "TRL")
    check_package("bitsandbytes", "BitsAndBytes")
    check_package("accelerate", "Accelerate")
    
    print("\n🌐 API Server:")
    check_package("fastapi", "FastAPI")
    check_package("uvicorn", "Uvicorn")
    
    print("\n☁️ Cloud Platform SDKs:")
    kaggle_ok = check_package("kaggle", "Kaggle SDK")
    runpod_ok = check_package("runpod", "RunPod SDK")
    
    print("\n" + "=" * 60)
    
    if not kaggle_ok or not runpod_ok:
        print("\n⚠️  Missing cloud SDKs! Run install_cloud_sdks.ps1 to install.")
        print("\nOr install manually:")
        if not kaggle_ok:
            print("  pip install kaggle>=1.6.0")
        if not runpod_ok:
            print("  pip install runpod>=1.6.0")
        return 1
    else:
        print("\n✅ All packages installed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
