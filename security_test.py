import requests

def test_security():
    auth = ('user', 'testpassword123')
    
    # Test path traversal
    response = requests.get('http://localhost:8000/api/download/../../../etc/passwd', auth=auth)
    print(f'Status: {response.status_code}')
    print(f'Content-Type: {response.headers.get("content-type", "N/A")}')
    print(f'Content length: {len(response.content)}')
    print(f'Response text: {response.text[:200]}')

if __name__ == "__main__":
    test_security()