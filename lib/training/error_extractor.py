"""
Production Error Extractor Module

Parses training log files to extract structured error information.
Handles Python tracebacks, CUDA errors, and common training failures.

Date: 2025-12-12
"""

import re
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict


@dataclass
class TracebackFrame:
    """Single frame in a traceback"""
    file: str
    line: int
    function: str
    code: Optional[str] = None


@dataclass
class TracebackInfo:
    """Parsed traceback information"""
    raw: str
    frames: List[TracebackFrame]
    exception_type: str
    exception_message: str

    def to_dict(self) -> Dict:
        result = asdict(self)
        result['frames'] = [asdict(f) for f in self.frames]
        return result


@dataclass
class StructuredError:
    """Single deduplicated error entry"""
    timestamp: str
    level: str
    phase: str
    message: str
    dedupe_key: str
    count: int = 1

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ErrorExtractionResult:
    """Complete error extraction result"""
    job_id: str
    errors: List[StructuredError]
    traceback: Optional[TracebackInfo]
    error_count: int
    unique_error_count: int

    def to_dict(self) -> Dict:
        return {
            'job_id': self.job_id,
            'errors': [e.to_dict() for e in self.errors],
            'traceback': self.traceback.to_dict() if self.traceback else None,
            'error_count': self.error_count,
            'unique_error_count': self.unique_error_count
        }


# Log line parsing regex
# Format: [TIMESTAMP] [MODULE] [LEVEL] [PHASE] MESSAGE
LOG_LINE_PATTERN = re.compile(
    r'^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*'  # Timestamp
    r'\[([^\]]+)\]\s*'  # Module
    r'\[([^\]]+)\]\s*'  # Level
    r'(?:\[([^\]]+)\]\s*)?'  # Phase (optional)
    r'(.*)$'  # Message
)

# Traceback patterns
TRACEBACK_START = re.compile(r'Traceback \(most recent call last\):')
TRACEBACK_FRAME = re.compile(
    r'^\s*File "([^"]+)", line (\d+), in (\w+)'
)
TRACEBACK_CODE = re.compile(r'^\s{4,}(\S.*)$')  # Indented code line
EXCEPTION_LINE = re.compile(
    r'^(\w+(?:\.\w+)*(?:Error|Exception|Warning)):\s*(.*)$'
)

# Error patterns for classification
ERROR_PATTERNS = {
    'cuda_oom': [
        r'CUDA out of memory',
        r'out of memory',
        r'OOM',
        r'torch\.cuda\.OutOfMemoryError'
    ],
    'cuda_error': [
        r'CUDA error',
        r'CUDA kernel',
        r'cudaErrorNoKernelImageForDevice',
        r'NCCL error'
    ],
    'tokenizer_error': [
        r'tokenizer\.chat_template',
        r'Cannot use chat template',
        r'template.*not set'
    ],
    'config_error': [
        r'padding-free',
        r'data collator',
        r'not supported when using'
    ],
    'import_error': [
        r'ImportError',
        r'ModuleNotFoundError',
        r'No module named'
    ],
    'value_error': [
        r'ValueError',
        r'invalid.*value',
        r'expected.*got'
    ]
}


def generate_dedupe_key(phase: str, message: str) -> str:
    """Generate a deduplication key for an error message"""
    # Use first 150 chars of message + phase
    normalized = f"{phase}:{message[:150]}".lower()
    # Remove numbers that might vary (line numbers, memory amounts, etc.)
    normalized = re.sub(r'\d+', 'N', normalized)
    return hashlib.md5(normalized.encode()).hexdigest()[:12]


def classify_error(message: str) -> str:
    """Classify error type based on message content"""
    message_lower = message.lower()

    for error_type, patterns in ERROR_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, message, re.IGNORECASE):
                return error_type

    return 'unknown'


def parse_log_line(line: str) -> Optional[Dict[str, str]]:
    """Parse a single log line into components"""
    match = LOG_LINE_PATTERN.match(line.strip())
    if match:
        return {
            'timestamp': match.group(1),
            'module': match.group(2),
            'level': match.group(3).lower(),
            'phase': match.group(4) or 'general',
            'message': match.group(5)
        }
    return None


def extract_traceback(lines: List[str]) -> Optional[TracebackInfo]:
    """Extract and parse Python traceback from log lines"""
    traceback_lines = []
    in_traceback = False
    frames = []
    exception_type = ''
    exception_message = ''

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Start of traceback
        if TRACEBACK_START.search(stripped):
            in_traceback = True
            traceback_lines = [stripped]
            frames = []
            continue

        if in_traceback:
            traceback_lines.append(stripped)

            # Parse frame
            frame_match = TRACEBACK_FRAME.match(stripped)
            if frame_match:
                frame = TracebackFrame(
                    file=frame_match.group(1),
                    line=int(frame_match.group(2)),
                    function=frame_match.group(3),
                    code=None
                )
                # Check next line for code
                if i + 1 < len(lines):
                    code_match = TRACEBACK_CODE.match(lines[i + 1])
                    if code_match:
                        frame.code = code_match.group(1)
                frames.append(frame)
                continue

            # Exception line (end of traceback)
            exc_match = EXCEPTION_LINE.match(stripped)
            if exc_match:
                exception_type = exc_match.group(1)
                exception_message = exc_match.group(2)
                in_traceback = False
                continue

            # Also check for simple error lines like "ERROR: Training failed: ..."
            if stripped.startswith('ERROR:') and not stripped.startswith('ERROR: '):
                pass  # Continue in traceback
            elif re.match(r'^[A-Z][a-z]+Error:', stripped):
                parts = stripped.split(':', 1)
                exception_type = parts[0]
                exception_message = parts[1].strip() if len(parts) > 1 else ''
                in_traceback = False

    if traceback_lines and (frames or exception_type):
        return TracebackInfo(
            raw='\n'.join(traceback_lines),
            frames=frames,
            exception_type=exception_type,
            exception_message=exception_message
        )

    return None


def extract_errors_from_log(log_content: str, job_id: str) -> ErrorExtractionResult:
    """
    Extract all errors from log content with deduplication.

    Args:
        log_content: Raw log file content
        job_id: Job identifier

    Returns:
        ErrorExtractionResult with parsed and deduplicated errors
    """
    lines = log_content.split('\n')

    # Track errors by dedupe key
    error_map: Dict[str, StructuredError] = {}
    total_errors = 0

    for line in lines:
        if not line.strip():
            continue

        parsed = parse_log_line(line)

        if parsed and parsed['level'] in ('error', 'warning'):
            total_errors += 1

            dedupe_key = generate_dedupe_key(parsed['phase'], parsed['message'])

            if dedupe_key in error_map:
                error_map[dedupe_key].count += 1
            else:
                error_map[dedupe_key] = StructuredError(
                    timestamp=parsed['timestamp'],
                    level=parsed['level'],
                    phase=parsed['phase'],
                    message=parsed['message'],
                    dedupe_key=dedupe_key,
                    count=1
                )

        # Also catch unformatted error lines
        elif 'error' in line.lower() or 'exception' in line.lower():
            if line.strip().startswith('ERROR:') or 'Error:' in line:
                total_errors += 1
                dedupe_key = generate_dedupe_key('raw', line)

                if dedupe_key not in error_map:
                    error_map[dedupe_key] = StructuredError(
                        timestamp='',
                        level='error',
                        phase='raw',
                        message=line.strip(),
                        dedupe_key=dedupe_key,
                        count=1
                    )
                else:
                    error_map[dedupe_key].count += 1

    # Extract traceback
    traceback = extract_traceback(lines)

    # Sort errors by timestamp (most recent first), then by count
    sorted_errors = sorted(
        error_map.values(),
        key=lambda e: (e.timestamp or '', -e.count),
        reverse=True
    )

    return ErrorExtractionResult(
        job_id=job_id,
        errors=sorted_errors,
        traceback=traceback,
        error_count=total_errors,
        unique_error_count=len(sorted_errors)
    )


def extract_errors_from_file(log_path: Path, job_id: str) -> ErrorExtractionResult:
    """
    Extract errors from a log file.

    Args:
        log_path: Path to log file
        job_id: Job identifier

    Returns:
        ErrorExtractionResult or empty result if file not found
    """
    if not log_path.exists():
        return ErrorExtractionResult(
            job_id=job_id,
            errors=[],
            traceback=None,
            error_count=0,
            unique_error_count=0
        )

    try:
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return extract_errors_from_log(content, job_id)
    except Exception as e:
        # Return error as a structured error
        return ErrorExtractionResult(
            job_id=job_id,
            errors=[StructuredError(
                timestamp='',
                level='error',
                phase='log_reader',
                message=f'Failed to read log file: {str(e)}',
                dedupe_key='log_read_error',
                count=1
            )],
            traceback=None,
            error_count=1,
            unique_error_count=1
        )


# Test function for development
if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        log_path = Path(sys.argv[1])
        job_id = log_path.stem.replace('job_', '')
        result = extract_errors_from_file(log_path, job_id)

        print(f"Job: {result.job_id}")
        print(f"Total errors: {result.error_count}")
        print(f"Unique errors: {result.unique_error_count}")
        print()

        if result.traceback:
            print("=== TRACEBACK ===")
            print(f"Exception: {result.traceback.exception_type}")
            print(f"Message: {result.traceback.exception_message}")
            print(f"Frames: {len(result.traceback.frames)}")
            for frame in result.traceback.frames[-3:]:
                print(f"  {frame.file}:{frame.line} in {frame.function}")
            print()

        print("=== ERRORS ===")
        for error in result.errors[:10]:
            print(f"[{error.level.upper()}] ({error.count}x) [{error.phase}] {error.message[:100]}")
    else:
        print("Usage: python error_extractor.py <log_file>")
