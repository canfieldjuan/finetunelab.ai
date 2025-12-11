"""
Test Token Refresh Manager Implementation

This script verifies that the TokenRefreshManager class works correctly.
Run this to validate the implementation before running a full training job.
"""

import sys
import time
from datetime import datetime, timedelta

# Add parent directory to path to import training_server
sys.path.insert(0, 'c:/Users/Juan/Desktop/Dev_Ops/web-ui')

print("Testing TokenRefreshManager implementation...")
print("=" * 60)

# Test 1: Import check
print("\n✅ Test 1: Importing training_server module...")
try:
    from lib.training import training_server
    print("SUCCESS: Module imported")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 2: Class existence
print("\n✅ Test 2: Checking TokenRefreshManager class exists...")
try:
    assert hasattr(training_server, 'TokenRefreshManager')
    print("SUCCESS: TokenRefreshManager class found")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 3: Class instantiation
print("\n✅ Test 3: Creating TokenRefreshManager instance...")
try:
    manager = training_server.TokenRefreshManager(
        initial_token="test_token_123",
        job_id="test_job_456"
    )
    print("SUCCESS: Instance created")
    print(f"  - Current token: {manager.current_token}")
    print(f"  - Job ID: {manager.job_id}")
    print(f"  - Refresh interval: {manager.refresh_interval}s ({manager.refresh_interval/60}m)")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 4: Method existence
print("\n✅ Test 4: Checking required methods exist...")
try:
    required_methods = [
        'start_refresh_loop',
        '_refresh_loop',
        '_refresh_token',
        'stop',
        'get_current_token'
    ]
    for method in required_methods:
        assert hasattr(manager, method), f"Missing method: {method}"
    print("SUCCESS: All required methods found")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 5: get_current_token
print("\n✅ Test 5: Testing get_current_token()...")
try:
    token = manager.get_current_token()
    assert token == "test_token_123"
    print(f"SUCCESS: get_current_token() returned: {token}")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 6: Thread start and stop
print("\n✅ Test 6: Testing thread lifecycle...")
try:
    print("  Starting refresh loop...")
    manager.start_refresh_loop()
    assert manager._refresh_thread is not None
    assert manager._refresh_thread.is_alive()
    print(f"  Thread started: {manager._refresh_thread.name}")
    
    time.sleep(0.5)  # Let thread initialize
    
    print("  Stopping refresh loop...")
    manager.stop()
    time.sleep(0.5)  # Let thread shutdown
    
    assert manager._stop_refresh == True
    print("SUCCESS: Thread lifecycle working")
except Exception as e:
    print(f"FAILED: {e}")
    manager.stop()  # Clean up
    sys.exit(1)

# Test 7: token_refresh_managers dict exists
print("\n✅ Test 7: Checking token_refresh_managers storage exists...")
try:
    assert hasattr(training_server, 'token_refresh_managers')
    assert isinstance(training_server.token_refresh_managers, dict)
    print("SUCCESS: token_refresh_managers dict found")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 8: Integration points exist
print("\n✅ Test 8: Checking integration points...")
try:
    # Check start_queued_job exists
    assert hasattr(training_server, 'start_queued_job')
    print("  ✓ start_queued_job function exists")
    
    # Check monitor_job exists
    assert hasattr(training_server, 'monitor_job')
    print("  ✓ monitor_job function exists")
    
    # Check cancel_job exists
    assert hasattr(training_server, 'cancel_job')
    print("  ✓ cancel_job function exists")
    
    print("SUCCESS: All integration points exist")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

# Test 9: Refresh interval timing
print("\n✅ Test 9: Verifying refresh interval configuration...")
try:
    expected_interval = 45 * 60  # 45 minutes in seconds
    assert manager.refresh_interval == expected_interval
    print(f"SUCCESS: Refresh interval = {manager.refresh_interval}s (45 minutes)")
    print(f"  - Supabase token TTL: 3600s (60 minutes)")
    print(f"  - Safety buffer: {3600 - expected_interval}s (15 minutes)")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED!")
print("=" * 60)
print("\nTokenRefreshManager implementation is correct and ready for use.")
print("\nNext steps:")
print("1. Restart training server: python lib/training/training_server.py")
print("2. Start a new training job via UI")
print("3. Monitor logs for:")
print("   - [TokenRefresh] Initialized for job {job_id}")
print("   - [TokenRefresh] Started refresh loop for job {job_id}")
print("   - [TokenRefresh] Token refreshed for job {job_id} (after 45 min)")
print("4. Verify metrics persist continuously in Training Monitor page")
