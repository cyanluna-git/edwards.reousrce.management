
import shutil
import subprocess
import os
import sys

def check_cmd(cmd, cwd='.'):
    print(f"--- Checking {cmd} ---")
    path = shutil.which(cmd)
    print(f"shutil.which('{cmd}') = {path}")
    
    try:
        if cmd == 'pnpm':
            args = ['pnpm', '--version']
        elif cmd == 'docker-compose':
            args = ['docker-compose', 'version']
        else:
            args = [cmd]
            
        print(f"Running: {args} in {cwd}")
        result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
        print(f"Return code: {result.returncode}")
        print(f"Stdout: {result.stdout.strip()}")
        print(f"Stderr: {result.stderr.strip()}")
        
    except FileNotFoundError:
        print(f"FAILED: FileNotFoundError - command not found by subprocess")
    except Exception as e:
        print(f"FAILED: {e}")

print(f"Current CWD: {os.getcwd()}")
print(f"PATH: {os.environ['PATH']}")

check_cmd('pnpm', cwd='./frontend')
check_cmd('docker-compose', cwd='./build_output/edwards_project') # Simulating script path
