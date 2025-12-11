"""
Predictions Scorer

Scores predictions against ground truth using various metrics.
Uses built-in Python functions - no external dependencies required.
"""


class PredictionsScorer:
    """Scores predictions with various quality metrics"""

    @staticmethod
    def score_prediction(prediction, ground_truth):
        """
        Score a prediction against ground truth

        Args:
            prediction: Model's generated text
            ground_truth: Expected correct answer

        Returns:
            dict: Scores for various metrics
        """
        if not ground_truth:
            return {}

        pred_clean = prediction.strip().lower()
        truth_clean = ground_truth.strip().lower()

        return {
            'exact_match': PredictionsScorer._exact_match(pred_clean, truth_clean),
            'char_error_rate': PredictionsScorer._character_error_rate(pred_clean, truth_clean),
            'length_ratio': PredictionsScorer._length_ratio(pred_clean, truth_clean),
            'word_overlap': PredictionsScorer._word_overlap(pred_clean, truth_clean)
        }

    @staticmethod
    def _exact_match(prediction, ground_truth):
        """Check if prediction exactly matches ground truth"""
        return 1.0 if prediction == ground_truth else 0.0

    @staticmethod
    def _character_error_rate(prediction, ground_truth):
        """
        Calculate character-level edit distance (Levenshtein)
        Returns normalized error rate (0.0 = perfect, 1.0 = completely wrong)
        """
        if not ground_truth:
            return 0.0 if not prediction else 1.0

        m, n = len(prediction), len(ground_truth)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if prediction[i-1] == ground_truth[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                else:
                    dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])

        edit_distance = dp[m][n]
        return min(1.0, edit_distance / max(len(ground_truth), 1))

    @staticmethod
    def _length_ratio(prediction, ground_truth):
        """
        Calculate length ratio between prediction and ground truth
        Returns ratio (1.0 = same length, >1.0 = prediction longer, <1.0 = prediction shorter)
        """
        if not ground_truth:
            return 0.0

        return len(prediction) / max(len(ground_truth), 1)

    @staticmethod
    def _word_overlap(prediction, ground_truth):
        """
        Calculate word-level overlap (simple precision)
        Returns ratio of prediction words that appear in ground truth
        """
        pred_words = set(prediction.split())
        truth_words = set(ground_truth.split())

        if not pred_words:
            return 0.0

        overlap = len(pred_words & truth_words)
        return overlap / len(pred_words)
