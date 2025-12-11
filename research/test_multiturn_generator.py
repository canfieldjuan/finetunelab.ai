#!/usr/bin/env python3
"""Test the multi-turn generator with 5 examples"""

import subprocess
import sys

# Create a test version that generates only 5 examples
test_script = """
import sys
sys.path.insert(0, '/home/juan-canfield/Desktop/web-ui/research')

# Modify the config
import production_multiturn_sft_generator as gen
gen.TOTAL_EXAMPLES = 5

# Run it
import asyncio
asyncio.run(gen.run_production(concurrent_batches=5))
"""

print("Testing multi-turn generator with 5 examples...")
print("="*70)

result = subprocess.run(
    ["python3", "-c", test_script],
    cwd="/home/juan-canfield/Desktop/web-ui/research",
    capture_output=False
)

sys.exit(result.returncode)
