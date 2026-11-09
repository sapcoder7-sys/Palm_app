"""Install a verified portable Node.js LTS in the project tools directory."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[1] / '.tools'
root.mkdir(exist_ok=True)
with urllib.request.urlopen('https://nodejs.org/dist/index.json') as response:
    release = next(item for item in json.load(response) if item['lts'])
version = release['version']
name = f'node-{version}-win-x64.zip'
base = f'https://nodejs.org/dist/{version}/'
archive = root / name
print(f'Downloading Node.js {version}', flush=True)
urllib.request.urlretrieve(base + name, archive)
with urllib.request.urlopen(base + 'SHASUMS256.txt') as response:
    expected = next(line.split()[0] for line in response.read().decode().splitlines() if line.split()[-1] == name)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'Node archive checksum mismatch'
with zipfile.ZipFile(archive) as bundle:
    bundle.extractall(root)
(root / 'node-path.txt').write_text(str(root / f'node-{version}-win-x64'))
print('Node.js installed and checksum verified.', flush=True)
