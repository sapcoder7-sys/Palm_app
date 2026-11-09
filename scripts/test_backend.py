"""Run integration tests against an isolated portable PostgreSQL cluster."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
tools = root / '.tools'
pg_ctl = tools / 'pgsql/bin/pg_ctl.exe'
data = tools / 'pgdata'
password_file = tools / 'pg-password.txt'
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
env = os.environ.copy()
env['TEST_DATABASE_URL'] = f"postgresql://palm_local:{password_file.read_text().strip()}@127.0.0.1:55432/postgres"
started = False
try:
    subprocess.run([str(pg_ctl), '-D', str(data), '-l', str(tools / 'postgres-test.log'), '-o', '-p 55432 -h 127.0.0.1', '-w', 'start'], check=True, creationflags=flags)
    started = True
    result = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-v'], cwd=root / 'backend', env=env)
finally:
    if started:
        subprocess.run([str(pg_ctl), '-D', str(data), '-m', 'fast', '-w', 'stop'], check=True, creationflags=flags)
sys.exit(result.returncode)
