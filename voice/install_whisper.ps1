param(
  [ValidateSet('tiny', 'tiny-q5', 'base', 'base-q5', 'all')]
  [string]$Model = 'all'
)

$ErrorActionPreference = 'Stop'
$release = 'v1.8.1'
$installDir = Join-Path $PSScriptRoot 'whisper-runtime\win32-x64\Release'
$serverPath = Join-Path $installDir 'whisper-server.exe'

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'The bundled Windows Whisper installer requires a 64-bit operating system.'
}

if (-not (Test-Path -LiteralPath $serverPath)) {
  $temporaryDir = Join-Path ([System.IO.Path]::GetTempPath()) ('bananza-whisper-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temporaryDir | Out-Null
  try {
    $archivePath = Join-Path $temporaryDir 'whisper-bin-x64.zip'
    $extractPath = Join-Path $temporaryDir 'extract'
    $downloadUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/$release/whisper-bin-x64.zip"
    Write-Host "Downloading whisper.cpp $release Windows x64 binaries"
    Invoke-WebRequest -Headers @{ 'User-Agent' = 'BananZa-Whisper-Installer' } -Uri $downloadUrl -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath
    $releaseDir = Join-Path $extractPath 'Release'
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDir 'whisper-server.exe'))) {
      throw 'The whisper.cpp release archive does not contain whisper-server.exe.'
    }
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    Copy-Item -Path (Join-Path $releaseDir '*') -Destination $installDir -Recurse -Force
  }
  finally {
    if (Test-Path -LiteralPath $temporaryDir) {
      Remove-Item -LiteralPath $temporaryDir -Recurse -Force
    }
  }
} else {
  Write-Host "Already installed: $serverPath"
}

& (Join-Path $PSScriptRoot 'download_whisper_models.ps1') -Model $Model
if (-not (Test-Path -LiteralPath $serverPath)) {
  throw "Whisper installation failed: $serverPath"
}

Write-Host 'Whisper is installed. BananZa can auto-start it when the provider is used.'
