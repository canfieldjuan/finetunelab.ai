import json
import yaml
import os
from typing import Dict, List, Any
from collections import defaultdict
from datetime import datetime

class Tier3BatchPreparer:
    def __init__(self, config_path: str = 'tier3_batch_config.yaml'):
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        self.reviews = []
        self.scored_reviews = []
        self.selected_reviews = []

    def load_extracted_reviews(self):
        source_file = self.config['input']['source_file']
        print(f"[*] Loading reviews from {source_file}")

        with open(source_file, 'r', encoding='utf-8') as f:
            for line in f:
                review = json.loads(line.strip())
                self.reviews.append(review)

        print(f"[*] Loaded {len(self.reviews)} reviews")

    def score_problem_complexity(self, review: Dict[str, Any]) -> int:
        score = 0
        weights = self.config['quality_scoring']['weights']
        complexity_config = self.config['quality_scoring']['problem_complexity']

        text = review.get('review_text', '').lower()
        keywords = review.get('matched_keywords', [])
        issue_types = review.get('issue_types', [])

        if len(keywords) >= 5:
            score += complexity_config['indicators']['multiple_keywords']

        timeline_keywords = self.config['quality_scoring']['diagnostic_context']['keywords']['timeline']
        if any(kw in text for kw in timeline_keywords):
            score += complexity_config['indicators']['timeline_mentioned']

        progression_indicators = ['then', 'after that', 'next', 'eventually', 'now']
        if any(ind in text for ind in progression_indicators):
            score += complexity_config['indicators']['progression_described']

        if len(issue_types) == 1:
            score += complexity_config['single_symptom']
        elif len(issue_types) == 2:
            score += complexity_config['multiple_symptoms']
        elif len(issue_types) >= 3:
            score += complexity_config['cause_effect_chain']

        max_score = weights['problem_complexity']
        return min(score, max_score)

    def score_diagnostic_context(self, review: Dict[str, Any]) -> int:
        score = 0
        weights = self.config['quality_scoring']['weights']
        context_config = self.config['quality_scoring']['diagnostic_context']

        text = review.get('review_text', '').lower()

        attempted_keywords = context_config['keywords']['attempted']
        if any(kw in text for kw in attempted_keywords):
            score += context_config['troubleshooting_attempted']

        error_keywords = context_config['keywords']['error_codes']
        if any(kw in text for kw in error_keywords):
            score += context_config['error_codes_mentioned']

        timeline_keywords = context_config['keywords']['timeline']
        timeline_count = sum(1 for kw in timeline_keywords if kw in text)
        if timeline_count >= 2:
            score += context_config['timeline_of_failure']

        max_score = weights['diagnostic_context']
        return min(score, max_score)

    def score_review_length(self, review: Dict[str, Any]) -> int:
        weights = self.config['quality_scoring']['weights']
        length_config = self.config['quality_scoring']['review_length']

        text_length = len(review.get('review_text', ''))

        if text_length >= length_config['long']:
            return weights['review_length']
        elif text_length >= length_config['medium']:
            return int(weights['review_length'] * 0.75)
        elif text_length >= length_config['short']:
            return int(weights['review_length'] * 0.5)
        else:
            return 0

    def score_hardware_category(self, review: Dict[str, Any]) -> int:
        weights = self.config['quality_scoring']['weights']
        priority_config = self.config['quality_scoring']['hardware_category_priority']

        categories = review.get('hardware_category', [])
        if not categories:
            return 0

        primary_category = categories[0]

        if primary_category in priority_config['high_value']:
            return weights['hardware_category']
        elif primary_category in priority_config['medium_value']:
            return int(weights['hardware_category'] * 0.67)
        elif primary_category in priority_config['low_value']:
            return int(weights['hardware_category'] * 0.33)
        else:
            return 0

    def score_issue_type(self, review: Dict[str, Any]) -> int:
        weights = self.config['quality_scoring']['weights']
        issue_config = self.config['quality_scoring']['issue_type_priority']

        issue_types = review.get('issue_types', [])
        if not issue_types:
            return 0

        has_complex = any(issue in issue_config['complex'] for issue in issue_types)
        if has_complex:
            return weights['issue_type']
        else:
            return int(weights['issue_type'] * 0.5)

    def calculate_total_score(self, review: Dict[str, Any]) -> int:
        complexity_score = self.score_problem_complexity(review)
        context_score = self.score_diagnostic_context(review)
        length_score = self.score_review_length(review)
        category_score = self.score_hardware_category(review)
        issue_score = self.score_issue_type(review)

        total = complexity_score + context_score + length_score + category_score + issue_score

        return total

    def score_all_reviews(self):
        print(f"[*] Scoring {len(self.reviews)} reviews...")

        for i, review in enumerate(self.reviews):
            score = self.calculate_total_score(review)
            review['quality_score'] = score
            self.scored_reviews.append(review)

            if (i + 1) % 10000 == 0:
                print(f"[*] Scored {i + 1}/{len(self.reviews)} reviews")

        self.scored_reviews.sort(key=lambda x: x['quality_score'], reverse=True)
        print(f"[*] Scoring complete. Top score: {self.scored_reviews[0]['quality_score']}")

    def select_top_reviews(self):
        min_score = self.config['quality_scoring']['minimum_score']
        target = self.config['quality_scoring']['target_examples']
        category_dist = self.config['category_distribution']

        print(f"[*] Selecting top {target} reviews with score >= {min_score}")

        selected_by_category = defaultdict(list)

        for review in self.scored_reviews:
            if review['quality_score'] < min_score:
                continue

            categories = review.get('hardware_category', [])
            if not categories:
                continue

            primary_category = categories[0]

            if primary_category not in category_dist:
                continue

            target_count = category_dist[primary_category]
            if len(selected_by_category[primary_category]) < target_count:
                selected_by_category[primary_category].append(review)

        for category, reviews in selected_by_category.items():
            print(f"  {category}: {len(reviews)} selected")
            self.selected_reviews.extend(reviews)

        print(f"[*] Total selected: {len(self.selected_reviews)}")

    def save_selected_reviews(self):
        output_file = self.config['output']['selected_reviews']
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            for review in self.selected_reviews:
                f.write(json.dumps(review, ensure_ascii=False) + '\n')

        print(f"[*] Saved selected reviews to {output_file}")

    def format_as_tier3_batch(self, reviews: List[Dict[str, Any]], batch_name: str) -> Dict[str, Any]:
        system_prompt = self.config['system_prompt']

        category_counts = defaultdict(int)
        issue_counts = defaultdict(int)

        for review in reviews:
            for cat in review.get('hardware_category', []):
                category_counts[cat] += 1
            for issue in review.get('issue_types', []):
                issue_counts[issue] += 1

        data_array = []
        for review in reviews:
            conversation = {
                "system": system_prompt,
                "conversations": [
                    {
                        "from": "user",
                        "value": review.get('review_text', '')
                    }
                ]
            }
            data_array.append(conversation)

        batch_data = {
            "metadata": {
                "tier": self.config['tier_info']['tier'],
                "tier_name": self.config['tier_info']['tier_name'],
                "goal": self.config['tier_info']['goal'],
                "description": self.config['tier_info']['description'],
                "total_examples": len(reviews),
                "category_breakdown": dict(category_counts),
                "issue_breakdown": dict(issue_counts),
                "format": "sharegpt",
                "target_model": self.config['tier_info']['target_model'],
                "system_prompt": system_prompt,
                "source_dataset": "Amazon Electronics Reviews",
                "quality_threshold": self.config['quality_scoring']['minimum_score'],
                "avg_tokens_per_response": self.config['deepseek_settings']['target_tokens'],
                "prerequisites": self.config['tier_info']['prerequisites'],
                "batch_name": batch_name,
                "created_at": datetime.now().isoformat()
            },
            "data": data_array
        }

        return batch_data

    def generate_batches(self):
        batch_dir = self.config['output']['batch_directory']
        os.makedirs(batch_dir, exist_ok=True)

        batch_configs = self.config['batch_organization']

        reviews_by_category = defaultdict(list)
        for review in self.selected_reviews:
            primary_cat = review.get('hardware_category', ['unknown'])[0]
            reviews_by_category[primary_cat].append(review)

        print(f"\n[*] Generating {len(batch_configs)} batches...")

        for batch_config in batch_configs:
            batch_name = batch_config['name']
            batch_reviews = []

            for category, count in batch_config['categories'].items():
                available = reviews_by_category[category][:count]
                batch_reviews.extend(available)
                reviews_by_category[category] = reviews_by_category[category][count:]

            batch_data = self.format_as_tier3_batch(batch_reviews, batch_name)

            output_path = os.path.join(batch_dir, batch_name)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, indent=2, ensure_ascii=False)

            print(f"  Created {batch_name}: {len(batch_reviews)} examples")

        print(f"\n[*] All batches saved to {batch_dir}")

    def print_statistics(self):
        print("\n" + "="*70)
        print("TIER 3 BATCH PREPARATION SUMMARY")
        print("="*70)

        print(f"Total reviews processed: {len(self.reviews)}")
        print(f"Total reviews scored: {len(self.scored_reviews)}")
        print(f"Total reviews selected: {len(self.selected_reviews)}")

        if self.scored_reviews:
            scores = [r['quality_score'] for r in self.scored_reviews]
            print(f"\nScore Statistics:")
            print(f"  Highest score: {max(scores)}")
            print(f"  Lowest score: {min(scores)}")
            print(f"  Average score: {sum(scores) / len(scores):.1f}")

        category_counts = defaultdict(int)
        for review in self.selected_reviews:
            primary_cat = review.get('hardware_category', ['unknown'])[0]
            category_counts[primary_cat] += 1

        print(f"\nSelected by Category:")
        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat}: {count}")

        print("="*70 + "\n")

if __name__ == '__main__':
    import sys

    config_file = sys.argv[1] if len(sys.argv) > 1 else 'tier3_batch_config.yaml'

    preparer = Tier3BatchPreparer(config_file)
    preparer.load_extracted_reviews()
    preparer.score_all_reviews()
    preparer.select_top_reviews()
    preparer.save_selected_reviews()
    preparer.generate_batches()
    preparer.print_statistics()
