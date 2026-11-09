param([string]$BuildId = '49b8132c-825f-46bd-b089-ab8484e5202c')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\expo-env.ps1"
$env:EAS_NO_VCS = '1'
Push-Location (Join-Path $projectRoot 'expo-app')
try {
    $build = npx --yes eas-cli@latest build:view $BuildId --json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read the Expo build.' }
} finally { Pop-Location }
if ($build.status -ne 'FINISHED') { throw "Build is $($build.status), not finished." }
$archiveUrl = $build.artifacts.applicationArchiveUrl
if (!$archiveUrl -or ([uri]$archiveUrl).Scheme -ne 'https') { throw 'Expo did not return a secure APK download URL.' }
$destination = Join-Path $projectRoot 'Palm_app.apk'
if (Test-Path $destination) { throw 'Palm_app.apk already exists; move it aside before downloading a different build.' }
Invoke-WebRequest -Uri $archiveUrl -OutFile $destination
if ((Get-Item $destination).Length -lt 1000000) { throw 'Downloaded APK is unexpectedly small.' }
$apksigner = Join-Path $projectRoot '.tools\android\build-tools\36.0.0\apksigner.bat'
if (Test-Path $apksigner) {
    & $apksigner verify --verbose $destination
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
}
Get-Item $destination | Select-Object FullName,Length
Get-FileHash -Algorithm SHA256 -LiteralPath $destination | Select-Object Hash
