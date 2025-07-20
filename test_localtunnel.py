import subprocess
import time
import re
import sys
import os

def test_localtunnel():
    print("Testing LocalTunnel connection...")
    
    # Try to start LocalTunnel
    try:
        # Check for npm path
        npm_path = subprocess.check_output(['where', 'npm'], text=True).strip().split('\n')[0]
        npm_dir = os.path.dirname(npm_path)
        
        # Look for lt in the same directory as npm
        lt_path = os.path.join(npm_dir, 'lt.cmd')
        
        if os.path.exists(lt_path):
            cmd = [lt_path, '--port', '8000', '--subdomain', 'test-connection']
        else:
            # Try with npx
            npx_path = os.path.join(npm_dir, 'npx.cmd')
            if os.path.exists(npx_path):
                cmd = [npx_path, 'localtunnel', '--port', '8000', '--subdomain', 'test-connection']
            else:
                # Last resort
                cmd = ['npx', 'localtunnel', '--port', '8000', '--subdomain', 'test-connection']
        
        print(f"Running command: {' '.join(cmd)}")
        
        # Start the process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Wait for URL to appear in output
        url = None
        start_time = time.time()
        
        print("Waiting for LocalTunnel URL (max 15 seconds)...")
        
        while time.time() - start_time < 15:  # 15 second timeout
            if process.poll() is not None:
                # Process ended, check for errors
                stderr = process.stderr.read()
                print(f"LocalTunnel process ended unexpectedly: {stderr}")
                break
            
            # Check if we have output
            line = process.stdout.readline()
            if line:
                print(f"Output: {line.strip()}")
                # Look for URL pattern
                url_match = re.search(r'https://[a-zA-Z0-9-]+\.loca\.lt', line)
                if url_match:
                    url = url_match.group(0)
                    print(f"Found URL: {url}")
                    break
            
            time.sleep(0.5)
        
        if url:
            print("✅ LocalTunnel test successful!")
        else:
            print("❌ Failed to get LocalTunnel URL")
        
        # Clean up
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        
        return url is not None
        
    except Exception as e:
        print(f"❌ Error testing LocalTunnel: {e}")
        return False

if __name__ == "__main__":
    success = test_localtunnel()
    sys.exit(0 if success else 1)