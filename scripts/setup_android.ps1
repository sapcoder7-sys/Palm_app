$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\tool-env.ps1"
flutter --version
if ($LASTEXITCODE -ne 0) { throw 'Flutter initialization failed.' }
$sdkManager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat'
1..20 | ForEach-Object { 'y' } | & $sdkManager --licenses
if ($LASTEXITCODE -ne 0) { throw 'Android license setup failed.' }
& $sdkManager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed.' }
