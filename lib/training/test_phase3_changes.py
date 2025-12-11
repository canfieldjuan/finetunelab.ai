"""
Phase 3 Implementation Verification Tests
Tests for WebSocket Streaming functionality in training_server.py

Run with: python test_phase3_changes.py
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
    """Test 1: Verify WebSocket imports are present"""
    print_test_header("Test 1: WebSocket Import Verification")
    
    try:
        # Import the training server module
        sys.path.insert(0, str(Path(__file__).parent))
        import training_server
        
        print_success("training_server module imported successfully")
        
        # Check for WebSocket in imports
        source = inspect.getsource(training_server)
        
        if 'WebSocket' in source:
            print_success("WebSocket import found")
        else:
            print_failure("WebSocket import not found")
            return False
        
        if 'WebSocketDisconnect' in source:
            print_success("WebSocketDisconnect import found")
        else:
            print_failure("WebSocketDisconnect import not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Import test failed: {e}")
        return False


def test_connection_manager():
    """Test 2: Verify ConnectionManager class exists"""
    print_test_header("Test 2: ConnectionManager Class Verification")
    
    try:
        import training_server
        
        # Check for ConnectionManager class
        if hasattr(training_server, 'ConnectionManager'):
            cm_class = training_server.ConnectionManager
            print_success("ConnectionManager class found")
            
            # Check for required methods
            required_methods = ['connect', 'disconnect', 'broadcast', 'get_connection_count']
            
            for method_name in required_methods:
                if hasattr(cm_class, method_name):
                    print_success(f"Method '{method_name}' exists")
                else:
                    print_failure(f"Method '{method_name}' missing")
                    return False
            
            # Check if methods are async (except get_connection_count)
            for method_name in ['connect', 'disconnect', 'broadcast']:
                method = getattr(cm_class, method_name)
                if inspect.iscoroutinefunction(method):
                    print_success(f"Method '{method_name}' is async")
                else:
                    print_failure(f"Method '{method_name}' is not async")
                    return False
            
        else:
            print_failure("ConnectionManager class not found")
            return False
        
        # Check for ws_manager instance
        if hasattr(training_server, 'ws_manager'):
            print_success("ws_manager instance found")
        else:
            print_failure("ws_manager instance not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"ConnectionManager test failed: {e}")
        return False


def test_websocket_endpoint():
    """Test 3: Verify WebSocket endpoint exists"""
    print_test_header("Test 3: WebSocket Endpoint Verification")
    
    try:
        import training_server
        
        # Look for WebSocket endpoint function
        endpoint_found = False
        
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                # Check for WebSocket decorator and endpoint
                if '@app.websocket' in source and '/ws/training' in source:
                    endpoint_found = True
                    print_success(f"WebSocket endpoint found: {name}")
                    
                    # Check function signature
                    sig = inspect.signature(obj)
                    params = list(sig.parameters.keys())
                    
                    if 'websocket' in params:
                        print_success("websocket parameter found")
                    else:
                        print_failure("websocket parameter not found")
                        return False
                    
                    if 'job_id' in params:
                        print_success("job_id parameter found")
                    else:
                        print_failure("job_id parameter not found")
                        return False
                    
                    # Check for key functionality in source
                    if 'ws_manager.connect' in source:
                        print_success("Calls ws_manager.connect()")
                    else:
                        print_failure("Doesn't call ws_manager.connect()")
                        return False
                    
                    if 'ws_manager.disconnect' in source:
                        print_success("Calls ws_manager.disconnect()")
                    else:
                        print_failure("Doesn't call ws_manager.disconnect()")
                        return False
                    
                    if 'send_json' in source:
                        print_success("Sends JSON messages")
                    else:
                        print_failure("Doesn't send JSON messages")
                        return False
                    
                    break
        
        if not endpoint_found:
            print_failure("WebSocket endpoint not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"WebSocket endpoint test failed: {e}")
        return False


def test_broadcast_integration():
    """Test 4: Verify broadcast integration in monitor_job"""
    print_test_header("Test 4: Broadcast Integration Verification")
    
    try:
        import training_server
        
        # Find monitor_job function
        if hasattr(training_server, 'monitor_job'):
            monitor_func = training_server.monitor_job
            print_success("monitor_job function found")
            
            # Check source for broadcast call
            source = inspect.getsource(monitor_func)
            
            if 'ws_manager.broadcast' in source:
                print_success("Calls ws_manager.broadcast()")
            else:
                print_failure("Doesn't call ws_manager.broadcast()")
                return False
            
            if 'get_connection_count' in source:
                print_success("Checks connection count before broadcasting")
            else:
                print_info("Warning: May broadcast without checking connection count")
            
        else:
            print_failure("monitor_job function not found")
            return False
        
        return True
        
    except Exception as e:
        print_failure(f"Broadcast integration test failed: {e}")
        return False


def test_no_breaking_changes():
    """Test 5: Verify no breaking changes to existing functionality"""
    print_test_header("Test 5: No Breaking Changes Verification")
    
    try:
        import training_server
        
        # Check existing functions still exist
        required_functions = [
            'pause_job',
            'resume_job',
            'cancel_job',
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
        
        # Check existing REST endpoints still exist
        # Look for HTTP endpoint decorators
        source = str(inspect.getsource(training_server))
        
        required_endpoints = [
            '/api/training/pause',
            '/api/training/resume',
            '/api/training/cancel',
            '/api/training/execute'
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


def test_protocol_design():
    """Test 6: Verify WebSocket protocol message structure"""
    print_test_header("Test 6: WebSocket Protocol Verification")
    
    try:
        import training_server
        
        # Find WebSocket endpoint
        for name, obj in inspect.getmembers(training_server):
            if inspect.iscoroutinefunction(obj):
                source = inspect.getsource(obj)
                
                if '@app.websocket' in source and '/ws/training' in source:
                    # Check for expected fields in messages
                    expected_fields = [
                        'job_id',
                        'status',
                        'progress',
                        'timestamp',
                        'complete'
                    ]
                    
                    for field in expected_fields:
                        if f'"{field}"' in source or f"'{field}'" in source:
                            print_success(f"Message includes '{field}' field")
                        else:
                            print_failure(f"Message missing '{field}' field")
                            return False
                    
                    return True
        
        print_failure("WebSocket endpoint not found for protocol check")
        return False
        
    except Exception as e:
        print_failure(f"Protocol design test failed: {e}")
        return False


def run_all_tests():
    """Run all verification tests"""
    print(f"\n{BLUE}{'=' * 70}{RESET}")
    print(f"{BLUE}Phase 3 Implementation Verification Test Suite{RESET}")
    print(f"{BLUE}{'=' * 70}{RESET}")
    
    tests = [
        ("WebSocket Import Verification", test_imports),
        ("ConnectionManager Class", test_connection_manager),
        ("WebSocket Endpoint", test_websocket_endpoint),
        ("Broadcast Integration", test_broadcast_integration),
        ("No Breaking Changes", test_no_breaking_changes),
        ("WebSocket Protocol", test_protocol_design)
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
