$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\expo-env.ps1"
$env:EAS_NO_VCS = '1'
Push-Location (Join-Path $projectRoot 'expo-app')
try {
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type checking failed.' }
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
    npx eas-cli@latest whoami
    if ($LASTEXITCODE -ne 0) { throw 'Sign in first using npx eas-cli@latest login from expo-app.' }
    npx eas-cli@latest project:init --account sapcoder --non-interactive
    if ($LASTEXITCODE -ne 0) { throw 'Expo project linking failed.' }
    npx eas-cli@latest build --platform android --profile preview
    if ($LASTEXITCODE -ne 0) { throw 'Expo build submission failed.' }
} finally { Pop-Location }
