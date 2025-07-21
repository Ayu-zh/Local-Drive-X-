import requests
import json
import base64
import tempfile
import os
from pathlib import Path

def test_comprehensive_api():
    """Test all API endpoints comprehensively."""
    base_url = "http://localhost:8000"
    username = "user"
    password = "testpassword123"
    
    print("🔍 Starting comprehensive API testing...")
    
    # Test 1: Setup endpoint
    print("\n1. Testing /api/setup endpoint...")
    setup_data = {
        "folder": str(Path.home() / "Documents"),  # Use user's Documents folder
        "space": 0.1,  # 100MB
        "password": password
    }
    
    response = requests.post(f"{base_url}/api/setup", json=setup_data)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        setup_result = response.json()
        print(f"   ✅ Setup successful! URL: {setup_result['url']}")
    else:
        print(f"   ❌ Setup failed: {response.text}")
        return False
    
    # Test 2: Authentication for file listing
    print("\n2. Testing /api/files endpoint with authentication...")
    auth = (username, password)
    
    response = requests.get(f"{base_url}/api/files", auth=auth)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        files_result = response.json()
        print(f"   ✅ File listing successful! Found {len(files_result['items'])} items")
        print(f"   Storage usage: {files_result['storage']['percent']:.1f}%")
        
        # Display first few files
        for i, item in enumerate(files_result['items'][:3]):
            print(f"      - {item['name']} ({'folder' if item['is_dir'] else 'file'})")
    else:
        print(f"   ❌ File listing failed: {response.text}")
        return False
    
    # Test 3: Test authentication failure
    print("\n3. Testing authentication failure...")
    bad_auth = (username, "wrongpassword")
    response = requests.get(f"{base_url}/api/files", auth=bad_auth)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 401:
        print("   ✅ Authentication correctly rejected bad credentials")
    else:
        print(f"   ❌ Expected 401 but got {response.status_code}")
    
    # Test 4: File upload
    print("\n4. Testing /api/upload endpoint...")
    
    # Create a test file
    test_content = "This is a test file for API testing\nGenerated automatically"
    test_filename = "api_test_file.txt"
    
    files = {'file': (test_filename, test_content, 'text/plain')}
    response = requests.post(f"{base_url}/api/upload", files=files, auth=auth)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        upload_result = response.json()
        print(f"   ✅ File upload successful: {upload_result['filename']}")
    else:
        print(f"   ❌ File upload failed: {response.text}")
    
    # Test 5: Download the uploaded file
    print("\n5. Testing /api/download endpoint...")
    
    response = requests.get(f"{base_url}/api/download/{test_filename}", auth=auth)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        downloaded_content = response.text
        if downloaded_content == test_content:
            print("   ✅ File download successful and content matches")
        else:
            print("   ❌ Downloaded content doesn't match uploaded content")
    else:
        print(f"   ❌ File download failed: {response.text}")
    
    # Test 6: Preview endpoint
    print("\n6. Testing /api/preview endpoint...")
    
    response = requests.get(f"{base_url}/api/preview/{test_filename}", auth=auth)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        print("   ✅ File preview successful")
    else:
        print(f"   ❌ File preview failed: {response.text}")
    
    # Test 7: Test invalid file paths (security)
    print("\n7. Testing path traversal security...")
    
    malicious_paths = [
        "../../../etc/passwd",
        "..\\..\\..\\Windows\\System32\\config\\sam",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    ]
    
    security_passed = True
    for malicious_path in malicious_paths:
        response = requests.get(f"{base_url}/api/download/{malicious_path}", auth=auth)
        if response.status_code == 200:
            print(f"   ❌ Security vulnerability: {malicious_path} was accessible")
            security_passed = False
        else:
            print(f"   ✅ Security check passed for: {malicious_path}")
    
    if security_passed:
        print("   ✅ All security checks passed")
    
    print("\n🎉 Comprehensive API testing completed!")
    return True

if __name__ == "__main__":
    test_comprehensive_api()