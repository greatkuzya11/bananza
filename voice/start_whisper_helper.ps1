$ErrorActionPreference = 'Stop'

$modelsDir = if ($env:BANANZA_WHISPER_MODELS_DIR) { $env:BANANZA_WHISPER_MODELS_DIR } else { Join-Path $PSScriptRoot 'models' }
$modelName = if ($env:BANANZA_WHISPER_START_MODEL) { $env:BANANZA_WHISPER_START_MODEL } else { 'ggml-tiny.bin' }
$hostName = if ($env:BANANZA_WHISPER_HOST) { $env:BANANZA_WHISPER_HOST } else { '127.0.0.1' }
$port = if ($env:BANANZA_WHISPER_PORT) { $env:BANANZA_WHISPER_PORT } else { '2701' }
$threads = if ($env:BANANZA_WHISPER_THREADS) { $env:BANANZA_WHISPER_THREADS } else { '1' }
$language = if ($env:BANANZA_WHISPER_LANGUAGE) { $env:BANANZA_WHISPER_LANGUAGE } else { 'ru' }

$serverBinary = $env:BANANZA_WHISPER_SERVER_BIN
if (-not $serverBinary) {
  $command = Get-Command whisper-server -ErrorAction SilentlyContinue
  if ($command) { $serverBinary = $command.Source }
}
if (-not $serverBinary) {
  $localCandidates = @(
    (Join-Path $PSScriptRoot 'whisper-runtime\win32-x64\Release\whisper-server.exe'),
    (Join-Path $PSScriptRoot 'whisper.cpp\build\bin\Release\whisper-server.exe'),
    (Join-Path $PSScriptRoot 'whisper.cpp\build\bin\whisper-server.exe')
  )
  $serverBinary = $localCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if (-not $serverBinary -or -not (Test-Path -LiteralPath $serverBinary)) {
  throw 'whisper-server was not found. Set BANANZA_WHISPER_SERVER_BIN.'
}
$modelPath = Join-Path $modelsDir $modelName
if (-not (Test-Path -LiteralPath $modelPath)) {
  throw "Whisper model was not found: $modelPath"
}

Set-Location $modelsDir
& $serverBinary `
  --host $hostName `
  --port $port `
  --threads $threads `
  --processors 1 `
  --language $language `
  --model $modelName `
  --no-gpu `
  --no-language-probabilities
