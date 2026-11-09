"""Download portable build tools into .tools; does not change system PATH."""
import json
from pathlib import Path
import subprocess
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
TOOLS.mkdir(exist_ok=True)


def unpack(url, target, archive):
    path = TOOLS / archive
    if not path.exists():
        print(f'Downloading {archive}', flush=True)
        urllib.request.urlretrieve(url, path)
    print(f'Extracting {archive}', flush=True)
    with zipfile.ZipFile(path) as zipped:
        zipped.extractall(target)


if not (TOOLS / 'pgsql/bin/postgres.exe').exists():
    unpack('https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip', TOOLS, 'postgres.zip')

if not (TOOLS / 'git/cmd/git.exe').exists():
    with urllib.request.urlopen('https://api.github.com/repos/git-for-windows/git/releases/latest') as response:
        release = json.load(response)
    asset = next(a for a in release['assets'] if a['name'].startswith('MinGit-') and a['name'].endswith('-64-bit.zip') and 'busybox' not in a['name'])
    unpack(asset['browser_download_url'], TOOLS / 'git', 'git.zip')

if not (TOOLS / 'flutter/bin/flutter.bat').exists():
    subprocess.run([str(TOOLS / 'git/cmd/git.exe'), 'clone', '--depth', '1', '--branch', 'stable', 'https://github.com/flutter/flutter.git', str(TOOLS / 'flutter')], check=True)

if not (TOOLS / 'android/cmdline-tools/latest/bin/sdkmanager.bat').exists():
    unpack('https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip', TOOLS / 'android-download', 'android.zip')
    destination = TOOLS / 'android/cmdline-tools/latest'
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(TOOLS / 'android-download/cmdline-tools', destination, dirs_exist_ok=True)
print('Portable tools ready.', flush=True)
