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
Copy-Item -Recurse (Join-Path $here "better-deepseek-harness") $target

# Append the insert row if absent (id-based dedupe on a comment marker).
$row = @"
# --- better-deepseek-harness ---
- insert:
    - id: ext-center
      name: better-deepseek-harness
"@
$content = if (Test-Path $patchFile) { Get-Content $patchFile -Raw } else { "" }
if ($content -notmatch "- id: ext-center") {
  Add-Content -Path $patchFile -Value $row -Encoding UTF8
}

Write-Host "better-deepseek-harness installed into profile '$Profile'."
Write-Host "The config watcher activates it live; refresh the Web UI to see the "更好的 DeepSeek Harness" settings section."
