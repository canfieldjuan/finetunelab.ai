"""
Phase 4 Implementation Verification Tests
Tests for Model Download functionality in training_server.py

Run with: python test_phase4_changes.py
"""

import sys
import inspect
from pathlib import Path

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_test_header(test_name: str):
    """Print formatted test header"""
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}")

def print_success(message: str):
    """Print success message"""
    print(f"{GREEN}✓ {message}{RESET}")

def print_failure(message: str):
    """Print failure message"""
    print(f"{RED}✗ {message}{RESET}")

def print_info(message: str):
    """Print info message"""
    print(f"{YELLOW}ℹ {message}{RESET}")


def test_imports():
    """Test 1: Verify download-related imports are present"""
    print_test_header("Test 1: Download Imports Verification")
    
    try:
        # Import the training server module
        sys.path.insert(0, str(Path(__file__).parent))
        import training_server
        
        print_success("training_server module imported successfully")
        
        # Check for required imports
        source = inspect.getsource(training_server)
        
        if 'zipfile' in source:
            print_success("zipfile import found")
        else:
            print_failure("zipfile import not found")
            return False
        
        if 'BytesIO' in source:
            print_success("BytesIO import found")
        else:
            print_failure("BytesIO import not found")
            return False
        
        if 'StreamingResponse' in source:
            print_success("StreamingResponse import found")
        else:
            print_failure("StreamingResponse import not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Import test failed: {e}")
        return False


def test_model_download_endpoint():
    """Test 2: Verify model download endpoint exists"""
    print_test_header("Test 2: Model Download Endpoint Verification")
    
    try:
        import training_server
        
        # Look for model download endpoint
        endpoint_found = False
        
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                # Check for model download decorator and path
                if '@app.get' in source and '/download/model' in source:
                    endpoint_found = True
                    print_success(f"Model download endpoint found: {name}")
                    
                    # Check function signature
                    sig = inspect.signature(obj)
                    params = list(sig.parameters.keys())
                    
                    if 'job_id' in params:
                        print_success("job_id parameter found")
                    else:
                        print_failure("job_id parameter not found")
                        return False
                    
                    if 'checkpoint' in params:
                        print_success("checkpoint parameter found (optional)")
                    else:
                        print_info("Warning: checkpoint parameter not found (should be optional)")
                    
                    # Check for key functionality
                    if 'zipfile.ZipFile' in source or 'ZipFile' in source:
                        print_success("Creates ZIP file")
                    else:
                        print_failure("Doesn't create ZIP file")
                        return False
                    
                    if 'StreamingResponse' in source:
                        print_success("Returns StreamingResponse")
                    else:
                        print_failure("Doesn't return StreamingResponse")
                        return False
                    
                    if 'BytesIO' in source or 'zip_buffer' in source:
                        print_success("Uses memory buffer for ZIP")
                    else:
                        print_failure("Doesn't use memory buffer")
                        return False
                    
                    # Check for path traversal protection
                    if '".."' in source or 'path traversal' in source.lower():
                        print_success("Has path traversal protection")
                    else:
                        print_info("Warning: Path traversal protection recommended")
                    
                    break
        
        if not endpoint_found:
            print_failure("Model download endpoint not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Model download endpoint test failed: {e}")
        return False


def test_logs_download_endpoint():
    """Test 3: Verify logs download endpoint exists"""
    print_test_header("Test 3: Logs Download Endpoint Verification")
    
    try:
        import training_server
        
        # Look for logs download endpoint
        endpoint_found = False
        
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                # Check for logs download decorator and path
                if '@app.get' in source and '/download/logs' in source:
                    endpoint_found = True
                    print_success(f"Logs download endpoint found: {name}")
                    
                    # Check function signature
                    sig = inspect.signature(obj)
                    params = list(sig.parameters.keys())
                    
                    if 'job_id' in params:
                        print_success("job_id parameter found")
                    else:
                        print_failure("job_id parameter not found")
                        return False
                    
                    # Check for key functionality
                    if 'zipfile.ZipFile' in source or 'ZipFile' in source:
                        print_success("Creates ZIP file")
                    else:
                        print_failure("Doesn't create ZIP file")
                        return False
                    
                    if 'StreamingResponse' in source:
                        print_success("Returns StreamingResponse")
                    else:
                        print_failure("Doesn't return StreamingResponse")
                        return False
                    
                    if 'training.log' in source or 'log_file' in source:
                        print_success("Includes training log file")
                    else:
                        print_failure("Doesn't include training log")
                        return False
                    
                    if 'progress.json' in source:
                        print_success("Includes progress.json file")
                    else:
                        print_info("Warning: progress.json not explicitly mentioned")
                    
                    break
        
        if not endpoint_found:
            print_failure("Logs download endpoint not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Logs download endpoint test failed: {e}")
        return False


def test_error_handling():
    """Test 4: Verify error handling in download endpoints"""
    print_test_header("Test 4: Error Handling Verification")
    
    try:
        import training_server
        
        # Check model download endpoint
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                if '/download/model' in source:
                    # Check for error handling
                    if 'try:' in source and 'except' in source:
                        print_success("Model download has try/except block")
                    else:
                        print_failure("Model download missing error handling")
                        return False
                    
                    if 'HTTPException' in source or 'raise' in source:
                        print_success("Raises HTTP exceptions for errors")
                    else:
                        print_failure("Doesn't raise HTTP exceptions")
                        return False
                    
                    if '404' in source:
                        print_success("Returns 404 for not found errors")
                    else:
                        print_info("Warning: 404 error code not found")
                
                elif '/download/logs' in source:
                    # Check logs endpoint error handling
                    if 'try:' in source and 'except' in source:
                        print_success("Logs download has try/except block")
                    else:
                        print_failure("Logs download missing error handling")
                        return False
        
        return True
        
    except Exception as e:
        print_failure(f"Error handling test failed: {e}")
        return False


def test_no_breaking_changes():
    """Test 5: Verify no breaking changes to existing functionality"""
    print_test_header("Test 5: No Breaking Changes Verification")
    
    try:
        import training_server
        
        # Check existing functions still exist
        required_functions = [
            'training_websocket',
            'pause_job',
            'resume_job',
            'cancel_job',
            'monitor_job',
            'execute_training'
        ]
        
        for func_name in required_functions:
            if hasattr(training_server, func_name):
                print_success(f"Existing function '{func_name}' still present")
            else:
                print_failure(f"Existing function '{func_name}' missing")
                return False
        
        # Check existing endpoints still exist
        source = str(inspect.getsource(training_server))
        
        required_endpoints = [
            '/ws/training',
            '/api/training/pause',
            '/api/training/resume',
            '/api/training/checkpoints'
        ]
        
        for endpoint in required_endpoints:
            if endpoint in source:
                print_success(f"Existing endpoint '{endpoint}' still present")
            else:
                print_failure(f"Existing endpoint '{endpoint}' missing")
                return False
        
        return True
        
    except Exception as e:
        print_failure(f"Breaking changes test failed: {e}")
        return False


def test_streaming_implementation():
    """Test 6: Verify streaming implementation details"""
    print_test_header("Test 6: Streaming Implementation Verification")
    
    try:
        import training_server
        
        # Check for proper streaming implementation
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                if '/download/model' in source or '/download/logs' in source:
                    # Check for ZIP buffer usage
                    if 'zip_buffer.seek(0)' in source:
                        print_success("Resets buffer position before streaming")
                    else:
                        print_failure("Doesn't reset buffer position")
                        return False
                    
                    # Check for proper media type
                    if 'application/zip' in source:
                        print_success("Sets correct media type (application/zip)")
                    else:
                        print_failure("Doesn't set correct media type")
                        return False
                    
                    # Check for Content-Disposition header
                    if 'Content-Disposition' in source and 'attachment' in source:
                        print_success("Sets Content-Disposition header")
                    else:
                        print_failure("Missing Content-Disposition header")
                        return False
        
        return True
        
    except Exception as e:
        print_failure(f"Streaming implementation test failed: {e}")
        return False


def run_all_tests():
    """Run all verification tests"""
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}Phase 4 Implementation Verification Test Suite{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}")
    
    tests = [
        ("Download Imports Verification", test_imports),
        ("Model Download Endpoint", test_model_download_endpoint),
        ("Logs Download Endpoint", test_logs_download_endpoint),
        ("Error Handling", test_error_handling),
        ("No Breaking Changes", test_no_breaking_changes),
        ("Streaming Implementation", test_streaming_implementation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_failure(f"Test '{test_name}' crashed: {e}")
            results.append((test_name, False))
    
    # Print summary
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name:.<50} {status}")
    
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    if passed == total:
        print(f"{GREEN}ALL TESTS PASSED: {passed}/{total}{RESET}")
    else:
        print(f"{RED}TESTS FAILED: {total - passed}/{total} failed, {passed}/{total} passed{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}\n")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
