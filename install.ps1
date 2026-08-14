# install.ps1 — bootstrap better-deepseek-harness into a dsh profile (no pnpm needed).
# Usage: .\install.ps1 [-Profile web]
param(
  [string]$Profile = "web"
)
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME ".dsh" }
$profilesModules = Join-Path $homeDir "profiles\node_modules"
$profileDir = Join-Path $homeDir ("profiles\" + $Profile)
$patchFile = Join-Path $profileDir "cordis.patch.yml"

if (-not (Test-Path $profileDir)) { throw "profile not found: $profileDir" }

New-Item -ItemType Directory -Force -Path $profilesModules | Out-Null
$target = Join-Path $profilesModules "better-deepseek-harness"
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Force -Path $target | Out-Null
# This repository's root *is* the package — copy its contents (skip .git history
# and never copy into ourselves if $target happens to live under $here).
Get-ChildItem -Force -Path $here |
  Where-Object { $_.Name -ne ".git" -and $_.FullName -ne $target -and -not $_.FullName.StartsWith($target + [IO.Path]::DirectorySeparatorChar) } |
  ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force }

# Append the insert row if absent (id-based dedupe on a comment marker).
$row = @"
# --- better-deepseek-harness ---
- insert:
    - id: ext-center
      name: better-deepseek-harness
"@
$content = if (Test-Path $patchFile) { Get-Content $patchFile -Raw } else { "" }
if ($content -notmatch "- id: ext-center") {
  # Append as UTF-8 without BOM: Add-Content -Encoding UTF8 writes a BOM on
  # Windows PowerShell 5.1, which would corrupt an existing patch file mid-stream.
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::AppendAllText($patchFile, $row, $utf8NoBom)
}

Write-Host "better-deepseek-harness installed into profile '$Profile'."
Write-Host 'The config watcher activates it live; refresh the Web UI to see the "更好的 DeepSeek Harness" settings section.'
