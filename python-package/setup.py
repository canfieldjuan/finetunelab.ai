# FineTune Lab - PyPI Package Setup
# Date: 2025-10-16
# Updated: 2025-12-13 - Separated core/training dependencies
# Purpose: SDK for training, inference, batch testing, and analytics

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="finetune-lab",
    version="0.2.0",
    author="FineTune Lab Team",
    author_email="support@finetunelab.com",
    description="FineTune Lab SDK - Training, inference, batch testing, and analytics for LLMs",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/finetune-lab/python-sdk",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.31.0",
    ],
    extras_require={
        "training": [
            "transformers>=4.35.0",
            "torch>=2.0.0",
            "datasets>=2.14.0",
            "peft>=0.6.0",
            "accelerate>=0.24.0",
            "bitsandbytes>=0.41.0",
            "trl>=0.7.0",
        ],
        "dev": ["pytest>=7.0", "black>=23.0", "flake8>=6.0"],
    },
    entry_points={
        "console_scripts": [
            "finetune-lab=finetune_lab.cli:main",
        ],
    },
)

print("[SetupPy] FineTune Lab Loader package configuration loaded")
