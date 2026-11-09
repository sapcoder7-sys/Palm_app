$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\expo-env.ps1"
Push-Location (Join-Path $projectRoot 'expo-app')
try { npx expo start } finally { Pop-Location }
