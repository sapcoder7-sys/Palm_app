$projectRoot = Split-Path $PSScriptRoot -Parent
$nodePathFile = Join-Path $projectRoot '.tools\node-path.txt'
if (Test-Path $nodePathFile) { $env:PATH = "$(Get-Content $nodePathFile);$env:PATH" }
$env:npm_config_cache = Join-Path $projectRoot '.tools\npm-cache'
$env:PATH = "$(Join-Path $projectRoot '.tools\git\cmd');$env:PATH"
