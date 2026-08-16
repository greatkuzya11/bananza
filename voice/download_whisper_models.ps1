param(
  [ValidateSet('tiny', 'tiny-q5', 'base', 'base-q5', 'all')]
  [string]$Model = 'all'
)

$ErrorActionPreference = 'Stop'
$modelsDir = if ($env:BANANZA_WHISPER_MODELS_DIR) { $env:BANANZA_WHISPER_MODELS_DIR } else { Join-Path $PSScriptRoot 'models' }
$baseUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
$expectedHashes = @{
  'ggml-tiny.bin' = 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21'
  'ggml-tiny-q5_1.bin' = '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7'
  'ggml-base.bin' = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
  'ggml-base-q5_1.bin' = '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898'
}
$models = switch ($Model) {
  'tiny' { @('ggml-tiny.bin') }
  'tiny-q5' { @('ggml-tiny-q5_1.bin') }
  'base' { @('ggml-base.bin') }
  'base-q5' { @('ggml-base-q5_1.bin') }
  'all' { @('ggml-tiny.bin', 'ggml-tiny-q5_1.bin', 'ggml-base.bin', 'ggml-base-q5_1.bin') }
}

New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
foreach ($modelName in $models) {
  $target = Join-Path $modelsDir $modelName
  $expectedHash = $expectedHashes[$modelName]
  if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 0) {
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw "Checksum mismatch for $target" }
    Write-Host "Already downloaded: $target"
    continue
  }
  $partial = "$target.part"
  Write-Host "Downloading $modelName"
  Invoke-WebRequest -Uri "$baseUrl/$modelName`?download=true" -OutFile $partial
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $partial).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -LiteralPath $partial -Force
    throw "Checksum mismatch for $modelName"
  }
  Move-Item -LiteralPath $partial -Destination $target -Force
}
