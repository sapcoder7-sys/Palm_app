"""Check official tool download endpoints without installing system software."""
import concurrent.futures
import urllib.request

URLS = {
    'flutter': 'https://storage.googleapis.com/flutter_infra_release/flutter/3.35.7/flutter_windows_3.35.7-stable.zip',
    'flutter_archive': 'https://storage.googleapis.com/flutter_infra_release/flutter/releases/stable/windows/flutter_windows_3.35.7-stable.zip',
    'postgres': 'https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip',
    'android': 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip',
    'git': 'https://api.github.com/repos/git-for-windows/git/releases/latest',
}


def check(item):
    name, url = item
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as response:
            print(name, response.status, response.headers.get('Content-Length', '?'), flush=True)
    except Exception as error:
        print(name, str(error), flush=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    list(pool.map(check, URLS.items()))
