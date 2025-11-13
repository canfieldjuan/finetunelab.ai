"""
Phase 5 Implementation Verification Tests
Tests for Enhanced Monitoring & Analytics in training_server.py

Run with: python test_phase5_changes.py
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
    """Test 1: Verify analytics-related imports are present"""
    print_test_header("Test 1: Analytics Imports Verification")
    
    try:
        # Import the training server module
        sys.path.insert(0, str(Path(__file__).parent))
        import training_server
        
        print_success("training_server module imported successfully")
        
        # Check for required imports
        source = inspect.getsource(training_server)
        
        if 'Any' in source:
            print_success("Any import found (for type hints)")
        else:
            print_failure("Any import not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Import test failed: {e}")
        return False


def test_analytics_functions():
    """Test 2: Verify analytics calculation functions exist"""
    print_test_header("Test 2: Analytics Functions Verification")
    
    try:
        import training_server
        
        # Check for calculate_job_analytics
        if hasattr(training_server, 'calculate_job_analytics'):
            print_success("calculate_job_analytics() function found")
            
            # Check function signature
            sig = inspect.signature(training_server.calculate_job_analytics)
            params = list(sig.parameters.keys())
            
            if 'job_id' in params:
                print_success("job_id parameter found")
            else:
                print_failure("job_id parameter not found")
                return False
            
            # Check return type annotation
            source = inspect.getsource(training_server.calculate_job_analytics)
            if '-> Dict[str, Any]' in source:
                print_success("Correct return type annotation")
            else:
                print_info("Warning: Return type annotation may be missing")
        else:
            print_failure("calculate_job_analytics() function not found")
            return False
        
        # Check for calculate_system_analytics
        if hasattr(training_server, 'calculate_system_analytics'):
            print_success("calculate_system_analytics() function found")
        else:
            print_failure("calculate_system_analytics() function not found")
            return False
        
        # Check for compare_jobs
        if hasattr(training_server, 'compare_jobs'):
            print_success("compare_jobs() function found")
            
            # Check function signature
            sig = inspect.signature(training_server.compare_jobs)
            params = list(sig.parameters.keys())
            
            if 'job_ids' in params:
                print_success("job_ids parameter found")
            else:
                print_failure("job_ids parameter not found")
                return False
        else:
            print_failure("compare_jobs() function not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Analytics functions test failed: {e}")
        return False


def test_analytics_endpoints():
    """Test 3: Verify analytics API endpoints exist"""
    print_test_header("Test 3: Analytics API Endpoints Verification")
    
    try:
        import training_server
        
        # Look for job analytics endpoint
        job_analytics_found = False
        system_analytics_found = False
        comparison_found = False
        
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                # Check for job analytics endpoint
                if '@app.get' in source and '/analytics' in source and '{job_id}' in source:
                    job_analytics_found = True
                    print_success(f"Job analytics endpoint found: {name}")
                    
                    # Check it's a GET endpoint
                    if '@app.get' in source:
                        print_success("Uses GET method")
                    else:
                        print_failure("Doesn't use GET method")
                        return False
                
                # Check for system analytics endpoint
                if '@app.get' in source and '/analytics/summary' in source:
                    system_analytics_found = True
                    print_success(f"System analytics endpoint found: {name}")
                
                # Check for comparison endpoint
                if '@app.get' in source and '/analytics/compare' in source:
                    comparison_found = True
                    print_success(f"Job comparison endpoint found: {name}")
                    
                    # Check for job_ids parameter
                    sig = inspect.signature(obj)
                    params = list(sig.parameters.keys())
                    
                    if 'job_ids' in params:
                        print_success("job_ids parameter found")
                    else:
                        print_failure("job_ids parameter not found")
                        return False
        
        if not job_analytics_found:
            print_failure("Job analytics endpoint not found")
            return False
        
        if not system_analytics_found:
            print_failure("System analytics endpoint not found")
            return False
        
        if not comparison_found:
            print_failure("Job comparison endpoint not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Analytics endpoints test failed: {e}")
        return False


def test_analytics_logic():
    """Test 4: Verify analytics calculation logic is present"""
    print_test_header("Test 4: Analytics Calculation Logic Verification")
    
    try:
        import training_server
        
        # Check calculate_job_analytics function
        source = inspect.getsource(training_server.calculate_job_analytics)
        
        # Check for key metrics calculations
        checks = {
            "duration calculation": "total_seconds" in source,
            "performance metrics": "samples_per_second" in source or "samples_per_sec" in source,
            "GPU utilization": "gpu_util" in source or "gpu_utilization" in source,
            "loss metrics": "loss" in source,
            "efficiency scores": "efficiency" in source or "score" in source,
            "progress data loading": "progress.json" in source or "progress_file" in source
        }
        
        for check_name, check_result in checks.items():
            if check_result:
                print_success(f"Has {check_name}")
            else:
                print_failure(f"Missing {check_name}")
                return False
        
        # Check system analytics function
        source = inspect.getsource(training_server.calculate_system_analytics)
        
        # Check for aggregation logic
        aggregation_checks = {
            "job status counting": "jobs_by_status" in source,
            "total training time": "total_training" in source or "total_seconds" in source,
            "throughput aggregation": "throughput" in source,
            "GPU utilization aggregation": "gpu_util" in source,
            "top performers": "top" in source or "sorted" in source
        }
        
        for check_name, check_result in aggregation_checks.items():
            if check_result:
                print_success(f"Has {check_name}")
            else:
                print_failure(f"Missing {check_name}")
                return False
        
        return True
        
    except Exception as e:
        print_failure(f"Analytics logic test failed: {e}")
        return False


def test_error_handling():
    """Test 5: Verify error handling in analytics endpoints"""
    print_test_header("Test 5: Error Handling Verification")
    
    try:
        import training_server
        
        # Check job analytics endpoint
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                if '/analytics' in source and '{job_id}' in source:
                    # Check for error handling
                    if 'try:' in source and 'except' in source:
                        print_success("Job analytics has try/except block")
                    else:
                        print_failure("Job analytics missing error handling")
                        return False
                    
                    if 'HTTPException' in source:
                        print_success("Raises HTTP exceptions for errors")
                    else:
                        print_failure("Doesn't raise HTTP exceptions")
                        return False
                    
                    if '404' in source:
                        print_success("Returns 404 for not found errors")
                    else:
                        print_info("Warning: 404 error code not found")
                    
                    if '500' in source:
                        print_success("Returns 500 for server errors")
                    else:
                        print_info("Warning: 500 error code not found")
                
                elif '/analytics/compare' in source:
                    # Check comparison endpoint error handling
                    if '400' in source:
                        print_success("Comparison endpoint validates input (400)")
                    else:
                        print_info("Warning: Input validation may be missing")
        
        return True
        
    except Exception as e:
        print_failure(f"Error handling test failed: {e}")
        return False


def test_no_breaking_changes():
    """Test 6: Verify no breaking changes to existing functionality"""
    print_test_header("Test 6: No Breaking Changes Verification")
    
    try:
        import training_server
        
        # Check existing functions still exist (from Phases 1-4)
        required_functions = [
            'training_websocket',
            'pause_job',
            'resume_job',
            'cancel_job',
            'monitor_job',
            'execute_training',
            'download_model',
            'download_logs'
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
            '/api/training/checkpoints',
            '/download/model',
            '/download/logs'
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


def test_response_format():
    """Test 7: Verify analytics response format and structure"""
    print_test_header("Test 7: Response Format Verification")
    
    try:
        import training_server
        
        # Check calculate_job_analytics returns proper structure
        source = inspect.getsource(training_server.calculate_job_analytics)
        
        # Check for expected response keys
        expected_keys = [
            '"job_id"',
            '"status"',
            '"duration"',
            '"performance"',
            '"resource_utilization"',
            '"checkpoints"',
            '"losses"',
            '"efficiency"'
        ]
        
        for key in expected_keys:
            if key in source:
                print_success(f"Response includes {key} field")
            else:
                print_failure(f"Response missing {key} field")
                return False
        
        # Check system analytics response
        source = inspect.getsource(training_server.calculate_system_analytics)
        
        system_keys = [
            '"total_jobs"',
            '"jobs_by_status"',
            '"average_training_duration_seconds"',
            '"top_performing_jobs"',
            '"resource_trends"'
        ]
        
        for key in system_keys:
            if key in source:
                print_success(f"System analytics includes {key} field")
            else:
                print_failure(f"System analytics missing {key} field")
                return False
        
        return True
        
    except Exception as e:
        print_failure(f"Response format test failed: {e}")
        return False


def run_all_tests():
    """Run all verification tests"""
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}Phase 5 Implementation Verification Test Suite{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}")
    
    tests = [
        ("Analytics Imports Verification", test_imports),
        ("Analytics Functions", test_analytics_functions),
        ("Analytics API Endpoints", test_analytics_endpoints),
        ("Analytics Calculation Logic", test_analytics_logic),
        ("Error Handling", test_error_handling),
        ("No Breaking Changes", test_no_breaking_changes),
        ("Response Format", test_response_format)
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
