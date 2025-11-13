"""
Phase 2 Implementation Verification Tests
Tests for Pause/Resume functionality in training_server.py

Run with: python test_phase2_changes.py
"""

import sys
import ast
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
    """Test 1: Verify all necessary imports are present"""
    print_test_header("Test 1: Import Verification")
    
    try:
        # Import the training server module
        sys.path.insert(0, str(Path(__file__).parent))
        import training_server
        
        print_success("training_server module imported successfully")
        
        # Check for JobStatusEnum
        if hasattr(training_server, 'JobStatusEnum'):
            enum_class = training_server.JobStatusEnum
            print_success("JobStatusEnum found")
            
            # Check for PAUSED status
            if hasattr(enum_class, 'PAUSED'):
                print_success(f"PAUSED status found: {enum_class.PAUSED.value}")
            else:
                print_failure("PAUSED status not found in JobStatusEnum")
                return False
        else:
            print_failure("JobStatusEnum not found")
            return False
        
        # Check for pause_job function
        if hasattr(training_server, 'pause_job'):
            print_success("pause_job() function found")
        else:
            print_failure("pause_job() function not found")
            return False
        
        # Check for resume_job function
        if hasattr(training_server, 'resume_job'):
            print_success("resume_job() function found")
        else:
            print_failure("resume_job() function not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Import test failed: {e}")
        return False


def test_paused_status():
    """Test 2: Verify PAUSED status is properly configured"""
    print_test_header("Test 2: PAUSED Status Configuration")
    
    try:
        import training_server
        
        enum_class = training_server.JobStatusEnum
        
        # Check PAUSED value
        if hasattr(enum_class, 'PAUSED'):
            paused_status = enum_class.PAUSED
            if paused_status.value == "paused":
                print_success(f"PAUSED status value correct: '{paused_status.value}'")
            else:
                print_failure(f"PAUSED status value incorrect: '{paused_status.value}' (expected 'paused')")
                return False
        else:
            print_failure("PAUSED status not found")
            return False
        
        # Verify all expected statuses exist
        expected_statuses = ['QUEUED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED']
        for status in expected_statuses:
            if hasattr(enum_class, status):
                print_success(f"Status {status} exists")
            else:
                print_failure(f"Status {status} missing")
                return False
        
        return True
        
    except Exception as e:
        print_failure(f"Status configuration test failed: {e}")
        return False


def test_job_status_dataclass():
    """Test 3: Verify JobStatus dataclass has paused_at field"""
    print_test_header("Test 3: JobStatus DataClass Verification")
    
    try:
        import training_server
        
        # Check for JobStatus class
        if hasattr(training_server, 'JobStatus'):
            job_status_class = training_server.JobStatus
            print_success("JobStatus class found")
            
            # Check for paused_at field
            if hasattr(job_status_class, '__dataclass_fields__'):
                fields = job_status_class.__dataclass_fields__
                if 'paused_at' in fields:
                    print_success("paused_at field found in JobStatus")
                    
                    # Check field type
                    field_type = fields['paused_at'].type
                    print_info(f"paused_at field type: {field_type}")
                    
                    # Should be Optional[str]
                    if 'Optional' in str(field_type) and 'str' in str(field_type):
                        print_success("paused_at field type is Optional[str]")
                    else:
                        print_failure(f"paused_at field type incorrect: {field_type}")
                        return False
                else:
                    print_failure("paused_at field not found in JobStatus")
                    return False
            else:
                print_failure("JobStatus is not a dataclass")
                return False
        else:
            print_failure("JobStatus class not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"JobStatus dataclass test failed: {e}")
        return False


def test_pause_job_function():
    """Test 4: Verify pause_job function signature and implementation"""
    print_test_header("Test 4: pause_job() Function Verification")
    
    try:
        import training_server
        
        pause_func = training_server.pause_job
        
        # Check function signature
        sig = inspect.signature(pause_func)
        params = list(sig.parameters.keys())
        
        print_info(f"Function signature: {sig}")
        
        # Should have job_id parameter
        if 'job_id' in params:
            print_success("job_id parameter found")
        else:
            print_failure("job_id parameter not found")
            return False
        
        # Check if it's async
        if inspect.iscoroutinefunction(pause_func):
            print_success("pause_job is an async function")
        else:
            print_failure("pause_job is not async")
            return False
        
        # Read source code to verify key operations
        source = inspect.getsource(pause_func)
        
        # Check for status validation
        if 'JobStatusEnum.RUNNING' in source or 'JobStatusEnum.PENDING' in source:
            print_success("Function validates job status")
        else:
            print_failure("Function doesn't validate job status")
            return False
        
        # Check for process termination
        if 'terminate_process_gracefully' in source:
            print_success("Function terminates process gracefully")
        else:
            print_failure("Function doesn't terminate process")
            return False
        
        # Check for PAUSED status assignment
        if 'JobStatusEnum.PAUSED' in source:
            print_success("Function sets PAUSED status")
        else:
            print_failure("Function doesn't set PAUSED status")
            return False
        
        # Check for paused_at timestamp
        if 'paused_at' in source and 'datetime' in source:
            print_success("Function sets paused_at timestamp")
        else:
            print_failure("Function doesn't set paused_at timestamp")
            return False
        
        # Check for persistence
        if 'persist_job' in source:
            print_success("Function persists job state")
        else:
            print_failure("Function doesn't persist job state")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"pause_job function test failed: {e}")
        return False


def test_resume_job_function():
    """Test 5: Verify resume_job function signature and implementation"""
    print_test_header("Test 5: resume_job() Function Verification")
    
    try:
        import training_server
        
        resume_func = training_server.resume_job
        
        # Check function signature
        sig = inspect.signature(resume_func)
        params = list(sig.parameters.keys())
        
        print_info(f"Function signature: {sig}")
        
        # Should have job_id parameter
        if 'job_id' in params:
            print_success("job_id parameter found")
        else:
            print_failure("job_id parameter not found")
            return False
        
        # Should have optional checkpoint_path parameter
        if 'checkpoint_path' in params:
            print_success("checkpoint_path parameter found")
            
            # Check if it's optional
            if sig.parameters['checkpoint_path'].default is not inspect.Parameter.empty:
                print_success("checkpoint_path is optional")
            else:
                print_failure("checkpoint_path is not optional")
                return False
        else:
            print_failure("checkpoint_path parameter not found")
            return False
        
        # Check if it's async
        if inspect.iscoroutinefunction(resume_func):
            print_success("resume_job is an async function")
        else:
            print_failure("resume_job is not async")
            return False
        
        # Read source code to verify key operations
        source = inspect.getsource(resume_func)
        
        # Check for PAUSED status validation
        if 'JobStatusEnum.PAUSED' in source:
            print_success("Function validates PAUSED status")
        else:
            print_failure("Function doesn't validate PAUSED status")
            return False
        
        # Check for checkpoint finding logic
        if 'checkpoint' in source.lower() and ('glob' in source or 'latest' in source.lower()):
            print_success("Function finds latest checkpoint")
        else:
            print_failure("Function doesn't find checkpoints")
            return False
        
        # Check for resume_from_checkpoint assignment
        if 'resume_from_checkpoint' in source:
            print_success("Function sets resume_from_checkpoint")
        else:
            print_failure("Function doesn't set resume_from_checkpoint")
            return False
        
        # Check for QUEUED status assignment
        if 'JobStatusEnum.QUEUED' in source:
            print_success("Function resets status to QUEUED")
        else:
            print_failure("Function doesn't reset to QUEUED")
            return False
        
        # Check for queue addition
        if 'job_queue.put' in source:
            print_success("Function adds job back to queue")
        else:
            print_failure("Function doesn't re-queue job")
            return False
        
        # Check for clearing paused_at
        if 'paused_at' in source and 'None' in source:
            print_success("Function clears paused_at timestamp")
        else:
            print_failure("Function doesn't clear paused_at")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"resume_job function test failed: {e}")
        return False


def test_api_endpoints():
    """Test 6: Verify pause and resume API endpoints exist"""
    print_test_header("Test 6: API Endpoints Verification")
    
    try:
        import training_server
        
        # Check for pause endpoint
        pause_endpoint_found = False
        resume_endpoint_found = False
        
        # Get all functions in module
        for name, obj in inspect.getmembers(training_server):
            if inspect.isfunction(obj) or inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                # Check for pause endpoint
                if '@app.post' in source and '/api/training/pause' in source:
                    pause_endpoint_found = True
                    print_success(f"Pause API endpoint found: {name}")
                
                # Check for resume endpoint
                if '@app.post' in source and '/api/training/resume' in source:
                    resume_endpoint_found = True
                    print_success(f"Resume API endpoint found: {name}")
        
        if not pause_endpoint_found:
            print_failure("Pause API endpoint not found")
            return False
        
        if not resume_endpoint_found:
            print_failure("Resume API endpoint not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"API endpoints test failed: {e}")
        return False


def test_no_breaking_changes():
    """Test 7: Verify no breaking changes to existing functionality"""
    print_test_header("Test 7: No Breaking Changes Verification")
    
    try:
        import training_server
        
        # Check existing functions still exist
        required_functions = [
            'cancel_job',
            'queue_worker',
            'monitor_job',
            'execute_training',
            'get_training_status',
            'terminate_process_gracefully'
        ]
        
        for func_name in required_functions:
            if hasattr(training_server, func_name):
                print_success(f"Existing function '{func_name}' still present")
            else:
                print_failure(f"Existing function '{func_name}' missing")
                return False
        
        # Check existing statuses still exist
        enum_class = training_server.JobStatusEnum
        existing_statuses = ['QUEUED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']
        
        for status in existing_statuses:
            if hasattr(enum_class, status):
                print_success(f"Existing status '{status}' still present")
            else:
                print_failure(f"Existing status '{status}' missing")
                return False
        
        return True
        
    except Exception as e:
        print_failure(f"Breaking changes test failed: {e}")
        return False


def run_all_tests():
    """Run all verification tests"""
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}Phase 2 Implementation Verification Test Suite{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}")
    
    tests = [
        ("Import Verification", test_imports),
        ("PAUSED Status Configuration", test_paused_status),
        ("JobStatus DataClass", test_job_status_dataclass),
        ("pause_job() Function", test_pause_job_function),
        ("resume_job() Function", test_resume_job_function),
        ("API Endpoints", test_api_endpoints),
        ("No Breaking Changes", test_no_breaking_changes)
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
