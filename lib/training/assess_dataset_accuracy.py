#!/usr/bin/env python3
"""
Assess dataset quality - not just format, but ACCURACY of content
Checks if responses contain correct information about FineTune Lab
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Tuple

# Known facts about YOUR FineTune Lab implementation
GROUND_TRUTH = {
    "file_paths": {
        "training_output": "lib/training/logs/job_<job_id>",
        "training_server": "lib/training/training_server.py",
        "dataset_validator": "lib/training/dataset_validator.py",
    },
    "api_endpoints": {
        "start_training": "/api/training/local/start",
        "deploy_model": "/api/training/deploy",
        "get_jobs": "/api/training/local/jobs",
    },
    "default_values": {
        "learning_rate": "2e-5",
        "gpu_memory": "0.8",
        "warmup_ratio": "0.03",
        "eval_split": "0.2",
    },
    "port_range": {
        "vllm_start": 8002,
        "vllm_end": 8020,
    },
    "supported_features": [
        "qlora",
        "lora",
        "flash attention",
        "vllm",
        "ollama",
        "tool calling",
        "dataset validation",
    ],
    "database": "supabase",
    "model_families": ["qwen", "llama", "mistral", "phi", "gemma"],
}

# Common quality issues to detect
QUALITY_CHECKS = {
    "hallucinated_features": [
        "automatic hyperparameter tuning",
        "built-in dataset generator",
        "one-click cloud deployment to AWS",
        "integrated web scraper",
        "automatic model compression",
    ],
    "vague_phrases": [
        "you can configure",
        "there are options",
        "it's possible to",
        "you might be able to",
        "depending on your setup",
    ],
    "outdated_info": [
        "docker is required",
        "python 3.8",
        "requires huggingface cli",
    ],
    "wrong_paths": [
        "training/outputs",
        "data/datasets",
        "models/checkpoints",
        "/opt/finetune",
    ],
}

class DatasetAccuracyAssessor:
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
        self.examples = []
        self.issues = defaultdict(list)
        self.scores = {
            "accuracy": 0,
            "specificity": 0,
            "completeness": 0,
            "helpfulness": 0,
        }

    def load_dataset(self):
        """Load dataset examples"""
        print(f"📂 Loading dataset: {self.dataset_path.name}\n")

        with open(self.dataset_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f, 1):
                try:
                    example = json.loads(line.strip())
                    self.examples.append(example)
                except Exception as e:
                    print(f"   ⚠️  Line {i}: {e}")

        print(f"   ✅ Loaded {len(self.examples)} examples\n")

    def check_hallucinated_features(self, text: str) -> List[str]:
        """Check if response mentions features that don't exist"""
        found = []
        text_lower = text.lower()
        for feature in QUALITY_CHECKS["hallucinated_features"]:
            if feature.lower() in text_lower:
                found.append(feature)
        return found

    def check_vague_responses(self, text: str) -> int:
        """Count vague/generic phrases"""
        count = 0
        text_lower = text.lower()
        for phrase in QUALITY_CHECKS["vague_phrases"]:
            count += text_lower.count(phrase)
        return count

    def check_wrong_paths(self, text: str) -> List[str]:
        """Check for incorrect file paths"""
        found = []
        for wrong_path in QUALITY_CHECKS["wrong_paths"]:
            if wrong_path in text:
                found.append(wrong_path)
        return found

    def check_correct_paths(self, text: str) -> List[str]:
        """Check for correct file paths mentioned"""
        found = []
        for key, correct_path in GROUND_TRUTH["file_paths"].items():
            # Remove variable parts for matching
            pattern = correct_path.replace("<job_id>", r"[a-f0-9\-]+")
            if re.search(pattern, text):
                found.append(key)
        return found

    def check_correct_endpoints(self, text: str) -> List[str]:
        """Check if correct API endpoints are mentioned"""
        found = []
        for key, endpoint in GROUND_TRUTH["api_endpoints"].items():
            if endpoint in text:
                found.append(key)
        return found

    def check_correct_defaults(self, text: str) -> List[str]:
        """Check if correct default values are mentioned"""
        found = []
        for key, value in GROUND_TRUTH["default_values"].items():
            if value in text:
                found.append(key)
        return found

    def calculate_specificity_score(self, text: str) -> int:
        """Score how specific vs generic the response is"""
        score = 50  # Start at middle

        # Positive indicators (specific)
        score += len(self.check_correct_paths(text)) * 10
        score += len(self.check_correct_endpoints(text)) * 10
        score += len(self.check_correct_defaults(text)) * 5

        # Check for code examples
        if "```" in text or "python" in text.lower():
            score += 10

        # Check for exact commands
        if any(cmd in text for cmd in ["npm", "python", "git", "pip"]):
            score += 5

        # Negative indicators (generic)
        score -= self.check_vague_responses(text) * 5
        score -= len(self.check_hallucinated_features(text)) * 20

        return max(0, min(100, score))

    def assess_example(self, example: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of a single example"""
        messages = example.get("messages", [])

        # Get assistant response
        assistant_msg = None
        for msg in messages:
            if msg.get("role") == "assistant":
                assistant_msg = msg.get("content", "")
                break

        if not assistant_msg:
            return {
                "score": 0,
                "issues": ["No assistant response found"]
            }

        issues = []

        # Check for hallucinated features
        hallucinations = self.check_hallucinated_features(assistant_msg)
        if hallucinations:
            issues.append(f"Hallucinated features: {', '.join(hallucinations)}")

        # Check for wrong paths
        wrong_paths = self.check_wrong_paths(assistant_msg)
        if wrong_paths:
            issues.append(f"Wrong file paths: {', '.join(wrong_paths)}")

        # Check vagueness
        vague_count = self.check_vague_responses(assistant_msg)
        if vague_count > 2:
            issues.append(f"Too vague ({vague_count} generic phrases)")

        # Check if response is too short (likely not helpful)
        if len(assistant_msg) < 50:
            issues.append("Response too short")

        # Calculate specificity
        specificity = self.calculate_specificity_score(assistant_msg)

        # Overall score
        score = specificity
        if hallucinations:
            score -= 30
        if wrong_paths:
            score -= 20
        if vague_count > 3:
            score -= 15

        score = max(0, min(100, score))

        return {
            "score": score,
            "specificity": specificity,
            "issues": issues,
            "correct_paths": self.check_correct_paths(assistant_msg),
            "correct_endpoints": self.check_correct_endpoints(assistant_msg),
            "correct_defaults": self.check_correct_defaults(assistant_msg),
        }

    def run_assessment(self, sample_size: int = 100):
        """Run full quality assessment on sample"""
        print(f"🔍 Assessing quality (sampling {sample_size} examples)...\n")

        # Sample examples
        import random
        random.seed(42)
        sample = random.sample(self.examples, min(sample_size, len(self.examples)))

        results = []
        total_score = 0
        issue_counts = defaultdict(int)

        for i, example in enumerate(sample, 1):
            result = self.assess_example(example)
            results.append(result)
            total_score += result["score"]

            for issue in result["issues"]:
                issue_type = issue.split(":")[0]
                issue_counts[issue_type] += 1

            if i % 25 == 0:
                print(f"   Processed {i}/{len(sample)} examples...")

        avg_score = total_score / len(sample)

        print(f"\n{'='*80}")
        print("QUALITY ASSESSMENT RESULTS")
        print(f"{'='*80}\n")

        print(f"📊 Overall Quality Score: {avg_score:.1f}/100\n")

        # Score breakdown
        if avg_score >= 80:
            quality = "EXCELLENT"
            emoji = "🟢"
        elif avg_score >= 60:
            quality = "GOOD"
            emoji = "🟡"
        elif avg_score >= 40:
            quality = "FAIR"
            emoji = "🟠"
        else:
            quality = "NEEDS IMPROVEMENT"
            emoji = "🔴"

        print(f"{emoji} Quality Rating: {quality}\n")

        # Issue breakdown
        if issue_counts:
            print("⚠️  Issues Found:")
            for issue_type, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
                pct = (count / len(sample)) * 100
                print(f"   {issue_type}: {count} ({pct:.1f}%)")
            print()

        # Count examples with correct information
        correct_paths = sum(1 for r in results if r["correct_paths"])
        correct_endpoints = sum(1 for r in results if r["correct_endpoints"])
        correct_defaults = sum(1 for r in results if r["correct_defaults"])

        print("✅ Correct Information:")
        print(f"   File paths: {correct_paths}/{len(sample)} examples ({(correct_paths/len(sample)*100):.1f}%)")
        print(f"   API endpoints: {correct_endpoints}/{len(sample)} examples ({(correct_endpoints/len(sample)*100):.1f}%)")
        print(f"   Default values: {correct_defaults}/{len(sample)} examples ({(correct_defaults/len(sample)*100):.1f}%)")
        print()

        # Score distribution
        score_ranges = {
            "Excellent (80-100)": sum(1 for r in results if r["score"] >= 80),
            "Good (60-79)": sum(1 for r in results if 60 <= r["score"] < 80),
            "Fair (40-59)": sum(1 for r in results if 40 <= r["score"] < 60),
            "Poor (<40)": sum(1 for r in results if r["score"] < 40),
        }

        print("📈 Score Distribution:")
        for range_name, count in score_ranges.items():
            pct = (count / len(sample)) * 100
            bar = "█" * int(pct / 5)
            print(f"   {range_name:20s} [{count:3d}] {bar} {pct:.1f}%")
        print()

        # Recommendations
        print("💡 Recommendations:")
        if avg_score < 60:
            print("   ⚠️  Dataset quality is below acceptable")
            print("   → Review and fix incorrect information")
            print("   → Add more specific examples with exact paths/values")
            print("   → Remove vague/generic responses")
        elif avg_score < 80:
            print("   → Add more examples with specific implementation details")
            print("   → Include more code examples and exact commands")
            print("   → Reduce generic/vague responses")
        else:
            print("   ✓ Dataset quality is good for training")
            print("   → Consider adding more edge cases and troubleshooting")
        print()

        # Find worst examples for review
        worst = sorted(results, key=lambda x: x["score"])[:5]
        if worst and worst[0]["score"] < 50:
            print("🔍 Examples Needing Review (lowest scores):")
            for i, result in enumerate(worst, 1):
                print(f"   {i}. Score: {result['score']}/100")
                if result["issues"]:
                    print(f"      Issues: {'; '.join(result['issues'][:2])}")
            print()

        return {
            "average_score": avg_score,
            "quality_rating": quality,
            "issue_counts": dict(issue_counts),
            "score_distribution": score_ranges,
        }

def main():
    import sys

    dataset_path = sys.argv[1] if len(sys.argv) > 1 else "/home/juan-canfield/Desktop/web-ui/output/In_progress/finetune_lab_with_navigation.jsonl"
    sample_size = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    assessor = DatasetAccuracyAssessor(dataset_path)
    assessor.load_dataset()
    assessor.run_assessment(sample_size)

if __name__ == "__main__":
    main()
