"""
Test validation in the training server with bad configs
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_bad_config(description, config, dataset_content=None):
    """Submit a bad config and verify we get a clear error"""
    print(f"\n{'=' * 70}")
    print(f"TEST: {description}")
    print('=' * 70)
    
    request_data = {
        "config": config,
        "dataset_path": "C:/temp/test.json",
        "dataset_content": dataset_content or [{"text": "test"}],
        "execution_id": "test-bad-config",
        "name": "Test Bad Config"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/training/execute",
            json=request_data,
            timeout=5
        )
        
        if response.status_code == 400:
            error = response.json()
            print(f"✓ Correctly rejected with 400 Bad Request")
            print(f"Error message: {error.get('detail', 'No detail')}")
        elif response.status_code == 200:
            print(f"✗ FAILED - Server accepted bad config!")
            print(f"Response: {response.json()}")
        else:
            print(f"? Unexpected status {response.status_code}")
            print(f"Response: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to server - make sure it's running on port 8000")
    except Exception as e:
        print(f"✗ Test error: {e}")

def main():
    """Run server validation tests"""
    print("\n" + "=" * 70)
    print("SERVER VALIDATION TESTS")
    print("Make sure training server is running on port 8000")
    print("=" * 70)
    
    test_bad_config(
        "Wrong LoRA targets for GPT-2",
        {
            "model": {"name": "gpt2"},
            "training": {"method": "sft", "num_epochs": 1},
            "lora": {
                "r": 8,
                "target_modules": ["q_proj", "v_proj"]
            }
        }
    )
    
    test_bad_config(
        "Chat template on GPT-2",
        {
            "model": {"name": "gpt2"},
            "data": {"strategy": "chat"},
            "training": {"method": "sft", "num_epochs": 1}
        }
    )
    
    test_bad_config(
        "Messages dataset with standard strategy",
        {
            "model": {"name": "gpt2"},
            "data": {"strategy": "standard"},
            "training": {"method": "sft", "num_epochs": 1}
        },
        dataset_content=[
            {"messages": [{"role": "user", "content": "test"}]}
        ]
    )
    
    test_bad_config(
        "Missing model.name",
        {
            "model": {"quantization": "4bit"},
            "training": {"method": "sft", "num_epochs": 1}
        }
    )
    
    test_bad_config(
        "Negative num_epochs",
        {
            "model": {"name": "gpt2"},
            "training": {"method": "sft", "num_epochs": -1}
        }
    )
    
    print("\n" + "=" * 70)
    print("VALIDATION TESTS COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
