import sys
import json
from collections import Counter

data = json.load(sys.stdin)
conv_counts = Counter(m['conversation_id'] for m in data)

print('Top 10 conversations by message count:')
print('=' * 80)
for conv_id, count in conv_counts.most_common(10):
    if count > 500:
        status = '[CRITICAL]'
    elif count > 100:
        status = '[HIGH]'
    elif count > 50:
        status = '[MEDIUM]'
    else:
        status = '[OK]'
    print(f'{status} {conv_id}: {count} messages')

print(f'\nTotal messages: {len(data)}')
print(f'Total conversations: {len(conv_counts)}')
