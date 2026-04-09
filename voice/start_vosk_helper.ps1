$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelsDir = Join-Path $PSScriptRoot 'models'
$helperPath = Join-Path $PSScriptRoot 'vosk_helper.py'

if (-not (Test-Path $helperPath)) {
  throw "Vosk helper script not found: $helperPath"
}

if (-not (Test-Path $modelsDir)) {
  throw "Vosk models directory not found: $modelsDir"
}

$env:BANANZA_VOSK_MODELS_DIR = (Resolve-Path $modelsDir).Path

Write-Host "BANANZA_VOSK_MODELS_DIR=$env:BANANZA_VOSK_MODELS_DIR"
Write-Host "Starting Vosk helper on http://127.0.0.1:2700"

Set-Location $repoRoot
python $helperPath
