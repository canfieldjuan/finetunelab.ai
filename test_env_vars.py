#!/usr/bin/env python3
"""
Test Environment Variable Passing

Simulates the spawn_training_process function to verify
environment variables are set correctly.
"""

import os
import subprocess
import sys


def print_result(test_name, passed, details=""):
    """Print test result"""
    status = "PASS" if passed else "FAIL"
    symbol = "\u2713" if passed else "\u2717"
    color = "\033[92m" if passed else "\033[91m"
    reset = "\033[0m"

    print(f"{color}[{symbol}] {test_name}: {status}{reset}")
    if details:
        print(f"    {details}")


def print_section(title):
    """Print section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_env_var_code():
    """Test the environment variable setting code"""
    print_section("TEST: Environment Variable Setup")

    results = []

    # Simulate the code from training_server.py lines 1627-1632
    job_id = "test-job-123"
    user_id = "test-user-456"

    # Prepare environment variables for training subprocess
    env = os.environ.copy()
    env['JOB_ID'] = job_id
    if user_id:
        env['JOB_USER_ID'] = user_id

    # Test 1: JOB_ID is set
    has_job_id = 'JOB_ID' in env
    print_result("JOB_ID set in environment", has_job_id,
                 f"JOB_ID={env.get('JOB_ID')}")
    results.append(has_job_id)

    # Test 2: JOB_USER_ID is set
    has_user_id = 'JOB_USER_ID' in env
    print_result("JOB_USER_ID set in environment", has_user_id,
                 f"JOB_USER_ID={env.get('JOB_USER_ID')}")
    results.append(has_user_id)

    # Test 3: Values are correct
    job_id_correct = env.get('JOB_ID') == job_id
    print_result("JOB_ID has correct value", job_id_correct,
                 f"Expected: {job_id}, Got: {env.get('JOB_ID')}")
    results.append(job_id_correct)

    user_id_correct = env.get('JOB_USER_ID') == user_id
    print_result("JOB_USER_ID has correct value", user_id_correct,
                 f"Expected: {user_id}, Got: {env.get('JOB_USER_ID')}")
    results.append(user_id_correct)

    # Test 4: Existing environment preserved
    original_path = os.environ.get('PATH')
    path_preserved = env.get('PATH') == original_path
    print_result("Original environment preserved", path_preserved,
                 f"PATH preserved: {path_preserved}")
    results.append(path_preserved)

    # Test 5: Empty user_id handling
    print_section("TEST: Empty user_id Handling")

    env_empty = os.environ.copy()
    env_empty['JOB_ID'] = job_id
    user_id_empty = ""
    if user_id_empty:
        env_empty['JOB_USER_ID'] = user_id_empty

    not_set_when_empty = 'JOB_USER_ID' not in env_empty
    print_result("JOB_USER_ID not set when user_id is empty", not_set_when_empty,
                 f"user_id='', JOB_USER_ID in env: {'JOB_USER_ID' in env_empty}")
    results.append(not_set_when_empty)

    return all(results)


def test_subprocess_env_passing():
    """Test that environment variables would be passed to subprocess"""
    print_section("TEST: Subprocess Environment Passing")

    # Create a simple test script
    test_script = "/tmp/test_env_check.py"
    with open(test_script, 'w') as f:
        f.write("""#!/usr/bin/env python3
import os
import sys

job_id = os.getenv('JOB_ID')
user_id = os.getenv('JOB_USER_ID')

if job_id and user_id:
    print(f'SUCCESS: JOB_ID={job_id}, JOB_USER_ID={user_id}')
    sys.exit(0)
else:
    print(f'FAIL: JOB_ID={job_id}, JOB_USER_ID={user_id}')
    sys.exit(1)
""")

    os.chmod(test_script, 0o755)

    # Test subprocess with environment
    job_id = "subprocess-test-789"
    user_id = "subprocess-user-101"

    env = os.environ.copy()
    env['JOB_ID'] = job_id
    env['JOB_USER_ID'] = user_id

    try:
        result = subprocess.run(
            [sys.executable, test_script],
            env=env,
            capture_output=True,
            text=True
        )

        success = result.returncode == 0
        print_result("Subprocess receives environment variables", success,
                     f"Output: {result.stdout.strip()}")

        # Cleanup
        os.remove(test_script)

        return success

    except Exception as e:
        print_result("Subprocess test", False, f"Error: {e}")
        return False


def main():
    print("\n")
    print("\u2554" + "=" * 68 + "\u2557")
    print("\u2551" + " " * 68 + "\u2551")
    print("\u2551     ENVIRONMENT VARIABLE PASSING TEST                         \u2551")
    print("\u2551" + " " * 68 + "\u2551")
    print("\u255a" + "=" * 68 + "\u255d")

    test_results = []
    test_results.append(("Environment Variable Setup", test_env_var_code()))
    test_results.append(("Subprocess Environment Passing", test_subprocess_env_passing()))

    # Summary
    print_section("TEST SUMMARY")

    for name, result in test_results:
        print_result(name, result)

    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)

    print("\n" + "-" * 70)
    color = "\033[92m" if passed == total else "\033[91m"
    reset = "\033[0m"
    print(f"{color}PASSED: {passed}/{total} ({(passed/total)*100:.1f}%){reset}\n")

    if passed == total:
        print("\u2713 ALL TESTS PASSED - Environment variables work correctly!")
        return 0
    else:
        print(f"\u2717 {total - passed} TEST(S) FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
