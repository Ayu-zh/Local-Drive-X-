import requests
import json
import sys

def test_api():
    print("Testing API endpoint...")
    
    # Test data
    test_data = {
        "folder": "C:\\Users\\Public\\Documents",  # Public Documents folder should exist on most Windows systems
        "space": 1,
        "password": "testpassword"
    }
    
    # Try both ports 8000 and 8001
    ports = [8000, 8001]
    for port in ports:
        print(f"\nTrying port {port}...")
        try:
            # Make the API request
            response = requests.post(
                f"http://localhost:{port}/api/setup",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            # Print response details
            print(f"Status code: {response.status_code}")
            print(f"Headers: {dict(response.headers)}")
            
            # Try to parse as JSON
            try:
                data = response.json()
                print(f"JSON response: {json.dumps(data, indent=2)}")
                return True
            except json.JSONDecodeError:
                print(f"Not a valid JSON response. Content: {response.text[:200]}...")
                return False
                
        except requests.exceptions.ConnectionError:
            print("Connection error: Could not connect to the API server. Is it running?")
            continue
        except Exception as e:
            print(f"Error: {e}")
            continue
    
    return False

if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)