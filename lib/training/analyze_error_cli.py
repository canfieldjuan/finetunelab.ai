#!/usr/bin/env python3
"""
CLI wrapper for error_analyzer.py

Provides command-line interface for analyzing training failures.
Called by Next.js API to generate config suggestions.

Usage:
  python analyze_error_cli.py --job-id <id> --error "<msg>" --config '{...}'

Date: 2025-11-10
Phase: Intelligent Resume Implementation - Phase 3
"""

import sys
import json
import argparse
import os

# Add the script's directory to Python path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from error_analyzer import analyze_training_failure


def main():
    """Main entry point for CLI"""
    parser = argparse.ArgumentParser(
        description='Analyze training failure and generate config suggestions'
    )
    parser.add_argument(
        '--job-id',
        required=True,
        help='Training job ID'
    )
    parser.add_argument(
        '--error',
        required=True,
        help='Error message from training logs'
    )
    parser.add_argument(
        '--config',
        required=True,
        help='Training configuration as JSON string'
    )

    args = parser.parse_args()

    try:
        # Parse config JSON
        try:
            config = json.loads(args.config)
        except json.JSONDecodeError as e:
            error_output = {
                "error": "Invalid config JSON",
                "details": str(e),
                "error_type": "invalid_input"
            }
            print(json.dumps(error_output), file=sys.stderr)
            sys.exit(1)

        # Analyze failure
        analysis = analyze_training_failure(args.error, config)

        # Convert to JSON-serializable dict
        result = {
            "job_id": args.job_id,
            "error_type": analysis.error_type,
            "error_phase": analysis.error_phase,
            "description": analysis.description,
            "confidence": analysis.confidence,
            "suggestions": [
                {
                    "field": s.field,
                    "current_value": s.current_value,
                    "suggested_value": s.suggested_value,
                    "reason": s.reason,
                    "impact": s.impact
                }
                for s in analysis.suggestions
            ]
        }

        # Output JSON to stdout
        print(json.dumps(result, indent=2))
        sys.exit(0)

    except Exception as e:
        # Catch-all error handler
        error_output = {
            "error": "Analysis failed",
            "details": str(e),
            "error_type": "internal_error"
        }
        print(json.dumps(error_output), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
