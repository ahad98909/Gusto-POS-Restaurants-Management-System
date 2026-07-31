import os
import sys
import subprocess
import urllib.request
import zipfile
import shutil

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(WORKSPACE, ".venv")
NODE_ENV_DIR = os.path.join(WORKSPACE, ".node-env")
REQUIREMENTS_PATH = os.path.join(WORKSPACE, "backend", "requirements.txt")

def check_global_command(cmd):
    try:
        shutil.which(cmd)
        return True
    except Exception:
        return False

def setup_venv():
    print("=== Setting up Python Virtual Environment ===")
    if not os.path.exists(VENV_DIR):
        print(f"Creating virtual environment in {VENV_DIR}...")
        subprocess.check_call([sys.executable, "-m", "venv", VENV_DIR])
    else:
        print("Virtual environment already exists.")

    python_exe = os.path.join(VENV_DIR, "Scripts", "python.exe") if os.name == "nt" else os.path.join(VENV_DIR, "bin", "python")
    print("Installing python requirements...")
    try:
        subprocess.check_call([python_exe, "-m", "pip", "install", "--upgrade", "pip"])
    except Exception as e:
        print(f"Pip upgrade skipped or failed: {e}")
    subprocess.check_call([python_exe, "-m", "pip", "install", "-r", REQUIREMENTS_PATH])
    print("Python environment setup completed successfully.")

def setup_node():
    print("\n=== Checking Node.js Environment ===")
    node_installed = False
    try:
        if check_global_command("node"):
            version = subprocess.check_output("node --version", shell=True, text=True).strip()
            print(f"Node.js is already installed globally on this machine. Version: {version}")
            node_installed = True
    except Exception as e:
        print(f"Global node command check failed: {e}")

    if node_installed:
        return

    print("Node.js was not found in the global path. Installing portable Node.js...")
    if os.path.exists(NODE_ENV_DIR):
        print("Portable Node.js environment already exists.")
        return

    node_url = "https://nodejs.org/dist/v20.15.1/node-v20.15.1-win-x64.zip"
    zip_path = os.path.join(WORKSPACE, "node_portable.zip")
    
    print(f"Downloading portable Node.js from {node_url}...")
    try:
        urllib.request.urlretrieve(node_url, zip_path)
        print("Download completed. Extracting to .node-env...")
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(WORKSPACE)
            
        # Rename the extracted folder to .node-env
        extracted_folder = os.path.join(WORKSPACE, "node-v20.15.1-win-x64")
        if os.path.exists(extracted_folder):
            os.rename(extracted_folder, NODE_ENV_DIR)
            
        print("Node.js portable installation complete.")
    except Exception as e:
        print(f"Error installing Node.js: {e}")
        print("Please ensure you have an active internet connection.")
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)

def create_helper_scripts():
    print("\n=== Creating Helper Scripts ===")
    
    # Check node path
    node_bin_dir = NODE_ENV_DIR if os.path.exists(NODE_ENV_DIR) else ""
    path_suffix = f";{NODE_ENV_DIR}" if node_bin_dir else ""
    
    # Run Backend Batch File
    run_backend_bat = os.path.join(WORKSPACE, "run_backend.bat")
    with open(run_backend_bat, "w") as f:
        f.write(f'@echo off\n')
        f.write(f'echo Starting FastAPI Backend...\n')
        f.write(f'cd /d "%~dp0backend"\n')
        f.write(f'call "%~dp0.venv\\Scripts\\activate.bat"\n')
        f.write(f'python run.py\n')
        f.write(f'pause\n')
        
    # Run Frontend Batch File
    run_frontend_bat = os.path.join(WORKSPACE, "run_frontend.bat")
    with open(run_frontend_bat, "w") as f:
        f.write(f'@echo off\n')
        f.write(f'echo Starting React/Vite Frontend...\n')
        f.write(f'cd /d "%~dp0frontend"\n')
        if node_bin_dir:
            f.write(f'set PATH=%PATH%;%~dp0.node-env\n')
        f.write(f'cmd /c npm run dev\n')
        f.write(f'pause\n')

    # Install Frontend Script
    setup_frontend_bat = os.path.join(WORKSPACE, "setup_frontend.bat")
    with open(setup_frontend_bat, "w") as f:
        f.write(f'@echo off\n')
        f.write(f'echo Installing Frontend Packages...\n')
        f.write(f'cd /d "%~dp0frontend"\n')
        if node_bin_dir:
            f.write(f'set PATH=%PATH%;%~dp0.node-env\n')
        f.write(f'cmd /c npm install\n')
        f.write(f'pause\n')

    # Setup MySQL Service Script
    setup_mysql_service_bat = os.path.join(WORKSPACE, "setup_mysql_service.bat")
    with open(setup_mysql_service_bat, "w") as f:
        f.write(f'@echo off\n')
        f.write(f':: Check for Administrator privileges\n')
        f.write(f'net session >nul 2>&1\n')
        f.write(f'if %errorLevel% == 0 (\n')
        f.write(f'    goto :run\n')
        f.write(f') else (\n')
        f.write(f'    goto :elevate\n')
        f.write(f')\n\n')
        f.write(f':elevate\n')
        f.write(f'    powershell -Command "Start-Process \'%~f0\' -Verb RunAs"\n')
        f.write(f'    exit /b\n\n')
        f.write(f':run\n')
        f.write(f'    echo Running with Administrator privileges...\n')
        f.write(f'    powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service -Name *mysql* | Select-Object -First 1; if ($svc) {{ Write-Host \'Found MySQL service:\' $svc.DisplayName; Set-Service -Name $svc.Name -StartupType Automatic; Start-Service -Name $svc.Name; Write-Host \'MySQL Service has been successfully configured to start automatically and is now running.\' -ForegroundColor Green }} else {{ Write-Host \'Could not find any service with name matching *mysql* on this system.\' -ForegroundColor Red }}"\n')
        f.write(f'    echo.\n')
        f.write(f'    pause\n')

    print("Created run_backend.bat, run_frontend.bat, setup_frontend.bat, and setup_mysql_service.bat.")

if __name__ == "__main__":
    setup_venv()
    setup_node()
    create_helper_scripts()
    print("\n=== Workspace environment is fully ready! ===")
