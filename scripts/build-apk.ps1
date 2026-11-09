param([string]$ApiBaseUrl = '', [switch]$DebugApk)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$portableFlutter = Join-Path $projectRoot '.tools\flutter\bin'
if (Test-Path $portableFlutter) {
    . "$PSScriptRoot\tool-env.ps1"
}
if (!(Get-Command flutter -ErrorAction SilentlyContinue)) { throw 'Install Flutter and the Android SDK, then rerun this script.' }
Push-Location (Join-Path $projectRoot 'mobile')
try {
    if (!(Test-Path 'android')) {
        flutter create --platforms=android --project-name=palm_app --org=com.palm .
        if ($LASTEXITCODE -ne 0) { throw 'Flutter scaffolding failed.' }
    }
    python (Join-Path $PSScriptRoot 'prepare_android.py')
    flutter pub get
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    flutter analyze
    if ($LASTEXITCODE -ne 0) { throw 'Flutter analysis failed.' }
    flutter test
    if ($LASTEXITCODE -ne 0) { throw 'Flutter tests failed.' }
    if ($DebugApk) { flutter build apk --debug "--dart-define=API_BASE_URL=$ApiBaseUrl" }
    else {
        python (Join-Path $PSScriptRoot 'ensure_signing.py')
        if ($LASTEXITCODE -ne 0) { throw 'Release signing setup failed.' }
        flutter build apk --release "--dart-define=API_BASE_URL=$ApiBaseUrl"
    }
    if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
} finally { Pop-Location }
