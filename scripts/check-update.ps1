Param()

$ErrorActionPreference = "Stop"

$repo = "gyro-mc/sco-mcp"
$installDirDefault = Join-Path $HOME ".local/share/opencode/osc-mcp"
$installDir = if ($env:OSC_MCP_INSTALL_DIR) { $env:OSC_MCP_INSTALL_DIR } else { $installDirDefault }
$pkgJson = Join-Path $installDir "package.json"

if (-not (Get-Command curl -ErrorAction SilentlyContinue)) {
  Write-Host "curl is required to check updates. Install curl and re-run."
  exit 1
}

if (-not (Test-Path $pkgJson)) {
  Write-Host "package.json not found at: $pkgJson"
  Write-Host "Set OSC_MCP_INSTALL_DIR if you installed elsewhere."
  exit 1
}

$localVersion = (Get-Content $pkgJson -Raw | ConvertFrom-Json).version
if (-not $localVersion) {
  Write-Host "Could not determine local version from $pkgJson"
  exit 1
}

$latestTag = (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest").tag_name
if (-not $latestTag) {
  Write-Host "Could not determine latest release tag."
  exit 1
}

$latestVersion = $latestTag.TrimStart("v")

Write-Host "Local version:  $localVersion"
Write-Host "Latest release: $latestTag"

if ($localVersion -eq $latestVersion -or ("v$localVersion" -eq $latestTag)) {
  Write-Host "Status: up to date."
} else {
  Write-Host "Status: update available."
  if ($env:OSC_MCP_REF) {
    Write-Host "Note: OSC_MCP_REF is set to '$env:OSC_MCP_REF' (pinned)."
  }
  Write-Host "Update with: ./scripts/install.ps1"
}
