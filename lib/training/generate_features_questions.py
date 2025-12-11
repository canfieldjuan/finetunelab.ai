#!/usr/bin/env python3
"""
Generate questions about Features Addendum
"""

from pathlib import Path
from typing import List

def generate_public_packages_questions() -> List[str]:
    """Questions about Public Packages Tab"""
    return [
        "What is the Public Packages Tab?",
        "What does the Public Packages Tab display?",
        "How do I share my training packages?",
        "What's included in a training package?",
        "How do I make a package public?",
        "How do I revoke public access to a package?",
        "What happens when I revoke access to a package?",
        "Can I make a private package public again?",
        "What information is shown for each public package?",
        "How many downloads does my package have?",
        "What is package sharing used for?",
        "Who can see my public packages?",
        "What's the purpose of access control in packages?",
        "How do public packages help collaboration?",
        "What status indicators are used for packages?",
        "Can I see how many people downloaded my package?",
        "What does 'revoke access' mean?",
        "Does revoking access affect existing downloads?",
        "How do I clone a public package?",
        "What happens to download count after revocation?",
    ]

def generate_datasets_questions() -> List[str]:
    """Questions about Datasets Tab"""
    return [
        "What file formats are supported for dataset upload?",
        "How do I upload a dataset?",
        "What is JSONL format?",
        "What's the recommended format for large datasets?",
        "Can I upload CSV datasets?",
        "What is Parquet format?",
        "How do I organize my datasets?",
        "What information is shown in the dataset library?",
        "Can I reuse the same dataset for multiple training configs?",
        "What does 'Upload once, use many times' mean?",
        "How do I attach a dataset to a training config?",
        "What is dataset validation?",
        "What happens during dataset validation?",
        "Can I preview my dataset?",
        "How do I search for datasets?",
        "What's the benefit of centralized dataset storage?",
        "Can I download my uploaded datasets?",
        "How do I delete a dataset?",
        "What does 'Used in training configs' mean?",
        "What validation status indicators exist?",
        "How big can my dataset be?",
        "What format is best for training?",
        "What is ShareGPT format?",
        "Can I upload plain text files?",
        "What are the benefits of dataset reusability?",
    ]

def generate_batch_testing_questions() -> List[str]:
    """Questions about Batch Testing & Benchmark Manager"""
    return [
        "What is the Batch Testing & Benchmark Manager?",
        "What is a benchmark in FineTune Lab?",
        "How do I create a benchmark?",
        "How many prompts can I include in a benchmark?",
        "What is batch testing used for?",
        "How do I run a batch test?",
        "What is an LLM Judge?",
        "Can I use GPT-4 for auto-scoring?",
        "Can I use Claude for auto-scoring?",
        "Where do test results appear?",
        "Can I manually review test results?",
        "Can I override automated scores?",
        "What metrics are shown in analytics?",
        "What is pass rate?",
        "How do I compare different models?",
        "What is a test suite?",
        "What's the purpose of systematic evaluation?",
        "How do I export test results?",
        "What is category breakdown in testing?",
        "Can I add notes to test results?",
        "How do I filter results by score?",
        "What is quality assurance testing?",
        "What is performance benchmarking?",
        "What is regression prevention?",
        "How do benchmarks help before deployment?",
    ]

def generate_regression_gates_questions() -> List[str]:
    """Questions about Regression Gates"""
    return [
        "What are Regression Gates?",
        "What is the purpose of regression gates?",
        "How do regression gates prevent bad deployments?",
        "What is a quality threshold?",
        "How do I configure a regression gate?",
        "What gate rules can I set?",
        "What happens if a model fails a gate?",
        "Can gates block deployments automatically?",
        "What is the minimum overall score threshold?",
        "What is the minimum pass rate threshold?",
        "What happens if a category score drops?",
        "Can I set latency thresholds?",
        "What actions occur when a gate fails?",
        "How do I search validation history?",
        "Can I search by model name?",
        "What information is in validation history?",
        "What is automated safety in regression gates?",
        "How do gates ensure quality control?",
        "Can I disable a regression gate?",
        "What notification options exist for gate failures?",
        "How do I track deployment decisions?",
        "What are historical trends in validation?",
        "How do gates prevent regressions?",
        "What is pass/fail status?",
        "How do I view score breakdown in gates?",
    ]

def generate_training_configs_questions() -> List[str]:
    """Questions about Training Configs Tab"""
    return [
        "What is the Training Configs Tab?",
        "What's the complete training workflow?",
        "How do I select a base model?",
        "Can I search for models?",
        "Can I use local models?",
        "Can I use Hugging Face models?",
        "What's the difference between edit and create config?",
        "How do I load an existing configuration?",
        "How many configurations can I save?",
        "What is shown in saved configurations?",
        "How do I attach a dataset to a configuration?",
        "When does the Generate Package button appear?",
        "What deployment targets are available?",
        "Can I deploy to Kaggle?",
        "Can I deploy to Hugging Face Spaces?",
        "What is local deployment target?",
        "How do I generate a training package?",
        "Can I use one dataset with multiple configs?",
        "What's the purpose of configuration library?",
        "How do I search datasets in saved configurations?",
        "Why does the button only appear after dataset attachment?",
        "What prevents incomplete training packages?",
        "How does the workflow provide guidance?",
        "Can I delete saved configurations?",
        "How do I enable rapid experimentation?",
    ]

def generate_features_overview_questions() -> List[str]:
    """General questions about all features"""
    return [
        "What are the main features in the addendum?",
        "How many additional features are documented?",
        "What is the status of these features?",
        "When was the features addendum last updated?",
        "Are all features fully implemented?",
        "What features help with collaboration?",
        "What features help with quality control?",
        "What features help with dataset management?",
        "What features help with testing?",
        "What features help with deployment safety?",
        "How do public packages and datasets work together?",
        "How do batch testing and regression gates work together?",
        "What's the relationship between configs and datasets?",
        "Which features involve automation?",
        "Which features involve manual review?",
    ]

def generate_workflow_questions() -> List[str]:
    """Questions about workflows described"""
    return [
        "What are the steps in the training config workflow?",
        "What comes after model selection?",
        "What comes after training configuration?",
        "What comes after dataset attachment?",
        "What's the final step before generating a package?",
        "How do I complete the entire workflow?",
        "What's required before generating a package?",
        "Can I skip dataset attachment?",
        "What guidance does the workflow provide?",
        "How does the UI prevent mistakes in the workflow?",
    ]

def generate_all_questions() -> List[str]:
    """Combine all questions"""
    all_q = []
    all_q.extend(generate_public_packages_questions())
    all_q.extend(generate_datasets_questions())
    all_q.extend(generate_batch_testing_questions())
    all_q.extend(generate_regression_gates_questions())
    all_q.extend(generate_training_configs_questions())
    all_q.extend(generate_features_overview_questions())
    all_q.extend(generate_workflow_questions())
    return all_q

def main():
    print("="*80)
    print("GENERATING FEATURES ADDENDUM QUESTIONS")
    print("="*80)
    print()

    questions = generate_all_questions()

    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_questions.txt")
    output_path.write_text('\n'.join(questions), encoding='utf-8')

    print(f"✅ Generated {len(questions)} questions!")
    print(f"📁 Saved to: {output_path}")
    print()
    print("📋 Question Breakdown:")
    print(f"   Public Packages: {len(generate_public_packages_questions())}")
    print(f"   Datasets: {len(generate_datasets_questions())}")
    print(f"   Batch Testing: {len(generate_batch_testing_questions())}")
    print(f"   Regression Gates: {len(generate_regression_gates_questions())}")
    print(f"   Training Configs: {len(generate_training_configs_questions())}")
    print(f"   Features Overview: {len(generate_features_overview_questions())}")
    print(f"   Workflows: {len(generate_workflow_questions())}")
    print()

if __name__ == "__main__":
    main()
