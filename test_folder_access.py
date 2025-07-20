import os
from pathlib import Path

def test_folder_access(folder_path):
    """Test if a folder exists and is accessible."""
    path = Path(folder_path)
    
    print(f"Testing access to folder: {path}")
    
    # Check if path exists
    if not path.exists():
        print(f"ERROR: Path does not exist: {path}")
        return False
    
    # Check if it's a directory
    if not path.is_dir():
        print(f"ERROR: Path is not a directory: {path}")
        return False
    
    # Check read access
    try:
        print(f"Checking read access...")
        contents = list(path.iterdir())
        print(f"Success! Found {len(contents)} items in directory")
    except PermissionError:
        print(f"ERROR: Permission denied when trying to read directory")
        return False
    except Exception as e:
        print(f"ERROR: Failed to read directory: {e}")
        return False
    
    # Check write access
    try:
        print(f"Checking write access...")
        test_file = path / "test_write_access.txt"
        with open(test_file, 'w') as f:
            f.write("test")
        print(f"Success! Created test file: {test_file}")
        
        # Clean up
        test_file.unlink()
        print(f"Removed test file")
    except PermissionError:
        print(f"WARNING: Permission denied when trying to write to directory (read-only)")
        # Continue anyway, we don't need write permissions
    except Exception as e:
        print(f"WARNING: Failed to write to directory: {e}")
        # Continue anyway, we don't need write permissions
    
    print(f"Folder {path} is accessible!")
    return True

if __name__ == "__main__":
    # Test C:\temp folder
    test_folder_access("C:\\temp")
    
    # Test C:\Windows folder (should be read-only)
    test_folder_access("C:\\Windows")
    
    # Test a non-existent folder
    test_folder_access("C:\\nonexistent_folder")