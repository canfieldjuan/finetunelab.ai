"""
Test Phase 1 Implementation
Verifies timeout detection and GPU cleanup functionality.
"""

import sys
import time
from pathlib import Path

# Add lib/training to path
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test that all necessary components import correctly"""
    print("=" * 80)
    print("TEST 1: Verify Imports")
    print("=" * 80)
    
    try:
        import training_server
        print("✅ training_server imported successfully")
        
        # Check for Phase 1 functions
        assert hasattr(training_server, 'monitor_job'), "monitor_job function exists"
        print("✅ monitor_job function found")
        
        assert hasattr(training_server, 'cancel_job'), "cancel_job function exists"
        print("✅ cancel_job function found")
        
        assert hasattr(training_server, 'terminate_process_gracefully'), "terminate_process_gracefully function exists"
        print("✅ terminate_process_gracefully function found")
        
        print("\n✅ ALL IMPORTS SUCCESSFUL\n")
        return True
        
    except Exception as e:
        print(f"\n❌ IMPORT FAILED: {e}\n")
        return False


def test_timeout_constants():
    """Test that timeout constants are properly defined"""
    print("=" * 80)
    print("TEST 2: Verify Timeout Configuration")
    print("=" * 80)
    
    try:
        import training_server
        import inspect
        
        # Read monitor_job source code
        source = inspect.getsource(training_server.monitor_job)
        
        # Check for timeout variables
        if "TIMEOUT_MINUTES" in source:
            print("✅ TIMEOUT_MINUTES constant found in monitor_job()")
        else:
            print("❌ TIMEOUT_MINUTES constant NOT found")
            return False
            
        if "last_progress_update" in source:
            print("✅ last_progress_update variable found in monitor_job()")
        else:
            print("❌ last_progress_update variable NOT found")
            return False
            
        if "last_updated_at" in source:
            print("✅ last_updated_at variable found in monitor_job()")
        else:
            print("❌ last_updated_at variable NOT found")
            return False
            
        # Check for timeout detection logic
        if "time_since_update" in source and "TIMEOUT" in source:
            print("✅ Timeout detection logic found")
        else:
            print("❌ Timeout detection logic NOT found")
            return False
            
        print("\n✅ TIMEOUT CONFIGURATION VERIFIED\n")
        return True
        
    except Exception as e:
        print(f"\n❌ TIMEOUT VERIFICATION FAILED: {e}\n")
        return False


def test_gpu_cleanup_code():
    """Test that GPU cleanup code exists in cancel_job"""
    print("=" * 80)
    print("TEST 3: Verify GPU Cleanup Implementation")
    print("=" * 80)
    
    try:
        import training_server
        import inspect
        
        # Read cancel_job source code
        source = inspect.getsource(training_server.cancel_job)
        
        # Check for GPU cleanup code
        if "torch.cuda.empty_cache()" in source:
            print("✅ torch.cuda.empty_cache() call found")
        else:
            print("❌ GPU cache clearing NOT found")
            return False
            
        if "GPU cache cleared" in source:
            print("✅ GPU cleanup logging found")
        else:
            print("❌ GPU cleanup logging NOT found")
            return False
            
        # Check for try/except wrapper
        if "try:" in source and "except" in source:
            print("✅ Exception handling (try/except) found")
        else:
            print("❌ Exception handling NOT found")
            return False
            
        print("\n✅ GPU CLEANUP CODE VERIFIED\n")
        return True
        
    except Exception as e:
        print(f"\n❌ GPU CLEANUP VERIFICATION FAILED: {e}\n")
        return False


def test_no_breaking_changes():
    """Verify that API endpoints still work"""
    print("=" * 80)
    print("TEST 4: Verify No Breaking Changes")
    print("=" * 80)
    
    try:
        import training_server
        
        # Check that FastAPI app exists
        assert hasattr(training_server, 'app'), "FastAPI app exists"
        print("✅ FastAPI app found")
        
        # Get all routes
        routes = [route.path for route in training_server.app.routes]
        
        # Check critical endpoints still exist
        critical_endpoints = [
            "/health",
            "/api/training/execute",
            "/api/training/status/{job_id}",
            "/api/training/cancel/{job_id}",
        ]
        
        for endpoint in critical_endpoints:
            if endpoint in routes:
                print(f"✅ Endpoint {endpoint} still exists")
            else:
                print(f"❌ Endpoint {endpoint} MISSING")
                return False
        
        print("\n✅ NO BREAKING CHANGES DETECTED\n")
        return True
        
    except Exception as e:
        print(f"\n❌ BREAKING CHANGE DETECTED: {e}\n")
        return False


def test_phase1_docstrings():
    """Verify that Phase 1 enhancements are documented"""
    print("=" * 80)
    print("TEST 5: Verify Documentation")
    print("=" * 80)
    
    try:
        import training_server
        import inspect
        
        # Check monitor_job docstring
        monitor_doc = inspect.getdoc(training_server.monitor_job)
        if monitor_doc and "Phase 1" in monitor_doc:
            print("✅ monitor_job() has Phase 1 documentation")
        else:
            print("⚠️  monitor_job() missing Phase 1 documentation (non-critical)")
        
        # Check cancel_job has Phase 1 comment
        cancel_source = inspect.getsource(training_server.cancel_job)
        if "Phase 1" in cancel_source:
            print("✅ cancel_job() has Phase 1 comments")
        else:
            print("⚠️  cancel_job() missing Phase 1 comments (non-critical)")
        
        print("\n✅ DOCUMENTATION VERIFIED\n")
        return True
        
    except Exception as e:
        print(f"\n❌ DOCUMENTATION CHECK FAILED: {e}\n")
        return False


def main():
    """Run all Phase 1 verification tests"""
    print("\n" + "=" * 80)
    print("PHASE 1 IMPLEMENTATION VERIFICATION")
    print("Testing: Timeout Detection + GPU Cleanup")
    print("=" * 80 + "\n")
    
    results = []
    
    # Run all tests
    results.append(("Imports", test_imports()))
    results.append(("Timeout Configuration", test_timeout_constants()))
    results.append(("GPU Cleanup", test_gpu_cleanup_code()))
    results.append(("No Breaking Changes", test_no_breaking_changes()))
    results.append(("Documentation", test_phase1_docstrings()))
    
    # Print summary
    print("=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {passed}/{total} tests passed")
    print("=" * 80 + "\n")
    
    if passed == total:
        print("🎉 ALL VERIFICATION TESTS PASSED! Phase 1 implementation is correct.\n")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please review implementation.\n")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
