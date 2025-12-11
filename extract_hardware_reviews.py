import gzip
import json
import yaml
import os
from typing import Dict, List, Any, Set
from datetime import datetime
from collections import defaultdict

class ReviewExtractor:
    def __init__(self, config_path: str = 'extraction_config.yaml'):
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        self.stats = {
            'total_processed': 0,
            'total_extracted': 0,
            'by_category': defaultdict(int),
            'by_issue': defaultdict(int),
            'by_rating': defaultdict(int),
            'start_time': datetime.now().isoformat(),
            'processing_speed': 0.0
        }

        self.progress = self._load_progress()
        self.extracted_reviews = []
        self.categorized = defaultdict(list)

    def _load_progress(self) -> Dict[str, Any]:
        progress_file = self.config['output']['progress_checkpoint']
        if os.path.exists(progress_file) and self.config['processing']['resume_enabled']:
            with open(progress_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'last_processed_index': 0, 'reviews_extracted': 0}

    def _save_progress(self):
        progress_file = self.config['output']['progress_checkpoint']
        os.makedirs(os.path.dirname(progress_file), exist_ok=True)
        progress_data = {
            'last_processed_index': self.stats['total_processed'],
            'reviews_extracted': self.stats['total_extracted'],
            'timestamp': datetime.now().isoformat()
        }
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress_data, f, indent=2)

    def _match_keywords(self, text: str, keywords: List[str]) -> bool:
        text_lower = text.lower()
        return any(keyword.lower() in text_lower for keyword in keywords)

    def _categorize_hardware(self, review_text: str) -> List[str]:
        categories = []
        hw_cats = self.config['hardware_categories']
        for category, keywords in hw_cats.items():
            if self._match_keywords(review_text, keywords):
                categories.append(category)
        return categories

    def _categorize_issues(self, review_text: str) -> List[str]:
        issues = []
        issue_types = self.config['issue_types']
        for issue_type, keywords in issue_types.items():
            if self._match_keywords(review_text, keywords):
                issues.append(issue_type)
        return issues

    def _filter_review(self, review: Dict[str, Any]) -> bool:
        filters = self.config['filters']

        if 'overall' not in review:
            return False

        if review['overall'] > filters['rating_threshold']:
            return False

        review_text = review.get('reviewText', '')
        if not review_text:
            return False

        text_length = len(review_text)
        if text_length < filters['min_review_length']:
            return False
        if text_length > filters['max_review_length']:
            return False

        return True

    def _extract_review_data(self, review: Dict[str, Any], index: int) -> Dict[str, Any]:
        review_text = review.get('reviewText', '')
        combined_text = review.get('summary', '') + ' ' + review_text

        hardware_cats = self._categorize_hardware(combined_text)
        issue_types = self._categorize_issues(combined_text)

        if not hardware_cats and not issue_types:
            return None

        matched_keywords = []
        for cat_keywords in self.config['hardware_categories'].values():
            for keyword in cat_keywords:
                if keyword.lower() in combined_text.lower():
                    matched_keywords.append(keyword)

        for issue_keywords in self.config['issue_types'].values():
            for keyword in issue_keywords:
                if keyword.lower() in combined_text.lower():
                    matched_keywords.append(keyword)

        return {
            'review_id': f"review_{index}",
            'asin': review.get('asin', ''),
            'rating': review.get('overall', 0),
            'summary': review.get('summary', ''),
            'review_text': review_text,
            'extracted_at': datetime.now().isoformat(),
            'matched_keywords': list(set(matched_keywords)),
            'hardware_category': hardware_cats,
            'issue_types': issue_types
        }

    def _update_statistics(self, extracted_data: Dict[str, Any]):
        for category in extracted_data['hardware_category']:
            self.stats['by_category'][category] += 1

        for issue in extracted_data['issue_types']:
            self.stats['by_issue'][issue] += 1

        rating = int(extracted_data['rating'])
        self.stats['by_rating'][rating] += 1

    def process_reviews(self, max_reviews: int = None):
        source_file = self.config['input']['source_file']
        checkpoint_interval = self.config['processing']['checkpoint_interval']
        start_index = self.progress['last_processed_index']

        print(f"[*] Starting extraction from index {start_index}")
        print(f"[*] Source: {source_file}")

        start_time = datetime.now()

        with gzip.open(source_file, 'rt', encoding=self.config['input']['encoding']) as f:
            for index, line in enumerate(f):
                if index < start_index:
                    continue

                if max_reviews and index >= start_index + max_reviews:
                    break

                try:
                    review = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                self.stats['total_processed'] += 1

                if not self._filter_review(review):
                    continue

                extracted_data = self._extract_review_data(review, index)
                if not extracted_data:
                    continue

                self.extracted_reviews.append(extracted_data)
                self._update_statistics(extracted_data)
                self.stats['total_extracted'] += 1

                for category in extracted_data['hardware_category']:
                    self.categorized[category].append(extracted_data)

                if self.stats['total_processed'] % checkpoint_interval == 0:
                    self._save_progress()
                    elapsed = (datetime.now() - start_time).total_seconds()
                    speed = self.stats['total_processed'] / elapsed if elapsed > 0 else 0
                    self.stats['processing_speed'] = speed

                    print(f"[*] Processed: {self.stats['total_processed']}, "
                          f"Extracted: {self.stats['total_extracted']}, "
                          f"Speed: {speed:.1f} reviews/sec")

        self._save_progress()
        print(f"[*] Extraction complete: {self.stats['total_extracted']} reviews extracted")

    def save_results(self):
        output_dir = os.path.dirname(self.config['output']['extracted_reviews'])
        os.makedirs(output_dir, exist_ok=True)

        jsonl_file = self.config['output']['extracted_reviews']
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            for review in self.extracted_reviews:
                f.write(json.dumps(review, ensure_ascii=False) + '\n')
        print(f"[*] Saved {len(self.extracted_reviews)} reviews to {jsonl_file}")

        categorized_file = self.config['output']['categorized_reviews']
        categorized_dict = {cat: reviews for cat, reviews in self.categorized.items()}
        with open(categorized_file, 'w', encoding='utf-8') as f:
            json.dump(categorized_dict, f, indent=2, ensure_ascii=False)
        print(f"[*] Saved categorized reviews to {categorized_file}")

        elapsed_time = (datetime.now() - datetime.fromisoformat(self.stats['start_time'])).total_seconds()
        self.stats['end_time'] = datetime.now().isoformat()
        self.stats['elapsed_seconds'] = elapsed_time

        stats_file = self.config['output']['statistics']
        stats_dict = dict(self.stats)
        stats_dict['by_category'] = dict(stats_dict['by_category'])
        stats_dict['by_issue'] = dict(stats_dict['by_issue'])
        stats_dict['by_rating'] = dict(stats_dict['by_rating'])

        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats_dict, f, indent=2, ensure_ascii=False)
        print(f"[*] Saved statistics to {stats_file}")

    def print_summary(self):
        print("\n" + "="*60)
        print("EXTRACTION SUMMARY")
        print("="*60)
        print(f"Total reviews processed: {self.stats['total_processed']}")
        print(f"Total reviews extracted: {self.stats['total_extracted']}")
        print(f"Processing speed: {self.stats['processing_speed']:.1f} reviews/sec")

        print("\nBy Hardware Category:")
        for category, count in sorted(self.stats['by_category'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {category}: {count}")

        print("\nBy Issue Type:")
        for issue, count in sorted(self.stats['by_issue'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {issue}: {count}")

        print("\nBy Rating:")
        for rating in sorted(self.stats['by_rating'].keys()):
            count = self.stats['by_rating'][rating]
            print(f"  {rating} stars: {count}")
        print("="*60 + "\n")

if __name__ == '__main__':
    import sys

    config_file = sys.argv[1] if len(sys.argv) > 1 else 'extraction_config.yaml'
    max_reviews = int(sys.argv[2]) if len(sys.argv) > 2 else None

    extractor = ReviewExtractor(config_file)
    extractor.process_reviews(max_reviews)
    extractor.save_results()
    extractor.print_summary()
