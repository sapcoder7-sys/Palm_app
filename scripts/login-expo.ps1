$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\expo-env.ps1"
Push-Location (Join-Path $projectRoot 'expo-app')
try { npx --yes eas-cli@latest login } finally { Pop-Location }
