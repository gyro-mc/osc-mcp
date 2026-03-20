Param(
  [switch]$NoConfig
)

$ErrorActionPreference = "Stop"

$repoUrlDefault = "https://github.com/gyro-mc/osc-mcp.git"
$repoUrl = if ($env:OSC_MCP_REPO_URL) { $env:OSC_MCP_REPO_URL } else { $repoUrlDefault }
$installDirDefault = Join-Path $HOME ".local/share/opencode/osc-mcp"
$installDir = if ($env:OSC_MCP_INSTALL_DIR) { $env:OSC_MCP_INSTALL_DIR } else { $installDirDefault }
$refDefault = "main"
$ref = if ($env:OSC_MCP_REF) { $env:OSC_MCP_REF } else { $refDefault }
$dataDirDefault = Join-Path $HOME ".local/share/opencode"
$configCandidates = @()
if ($env:XDG_CONFIG_HOME) {
  $configCandidates += (Join-Path $env:XDG_CONFIG_HOME "opencode/opencode.json")
}
if ($env:APPDATA) {
  $configCandidates += (Join-Path $env:APPDATA "opencode/opencode.json")
}
if ($env:LOCALAPPDATA) {
  $configCandidates += (Join-Path $env:LOCALAPPDATA "opencode/opencode.json")
}
$configCandidates += (Join-Path $HOME ".config/opencode/opencode.json")
$configCandidates += (Join-Path $HOME "Library/Application Support/opencode/opencode.json")

$opencodeConfig = $null
foreach ($candidate in $configCandidates) {
  if (Test-Path $candidate) {
    $opencodeConfig = $candidate
    break
  }
}
if (-not $opencodeConfig) {
  if ($env:APPDATA) {
    $opencodeConfig = (Join-Path $env:APPDATA "opencode/opencode.json")
  } else {
    $opencodeConfig = (Join-Path $HOME ".config/opencode/opencode.json")
  }
  if (-not (Test-Path $opencodeConfig)) {
    Write-Host "OpenCode config not found at expected locations."
    Write-Host "Create the config or set your config directory, then re-run."
    Write-Host ""
    Write-Host "Expected default config:"
    Write-Host "  $opencodeConfig"
    exit 1
  }
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun is required but not installed. Install from https://bun.sh and re-run."
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git is required but not installed. Install git and re-run."
  exit 1
}

if (-not (Test-Path $dataDirDefault)) {
  Write-Host "OpenCode data directory not found at:"
  Write-Host "  $dataDirDefault"
  Write-Host ""
  Write-Host "Set OPENCODE_DB to your actual path and re-run this script."
  exit 1
}

if (Test-Path (Join-Path $installDir ".git")) {
  Write-Host "Updating existing install in $installDir"
  if ($env:OSC_MCP_REF) {
    git -C $installDir fetch --tags
    git -C $installDir checkout $ref
  } else {
    git -C $installDir pull --ff-only
  }
} else {
  Write-Host "Cloning to $installDir"
  New-Item -ItemType Directory -Force -Path (Split-Path $installDir) | Out-Null
  git clone $repoUrl $installDir
  if ($env:OSC_MCP_REF) {
    git -C $installDir checkout $ref
  }
}

Write-Host "Installing dependencies..."
bun install --cwd $installDir

Write-Host "Building..."
bun run --cwd $installDir build

Write-Host "Updating OpenCode config"

$configUpdated = $false

if (-not $NoConfig -and (Test-Path $opencodeConfig)) {
  try {
    $raw = Get-Content $opencodeConfig -Raw
    $data = $raw | ConvertFrom-Json
    if (-not ($data.mcp -is [hashtable])) {
      $data.mcp = @{}
    }
    if (-not $data.mcp.ContainsKey("osc-mcp")) {
      $data.mcp["osc-mcp"] = @{
        type = "local"
        enabled = $true
        command = @("bun", "$installDir/dist/index.js")
      }
    }
    $json = $data | ConvertTo-Json -Depth 10
    Set-Content -Path $opencodeConfig -Value $json
    $configUpdated = $true
  } catch {
    $configUpdated = $false
  }
}

if ($configUpdated) {
  Write-Host "Updated OpenCode config: $opencodeConfig"
} else {
  Write-Host "Could not auto-update OpenCode config (missing JSON support, parse failed, or skipped)."
  Write-Host "Add this MCP entry to your config if not present:"
  Write-Host "  \"osc-mcp\": {"
  Write-Host "    \"type\": \"local\"," 
  Write-Host "    \"enabled\": true,"
  Write-Host "    \"command\": [\"bun\", \"$installDir/dist/index.js\"]"
  Write-Host "  }"
}

Write-Host "Done. Restart OpenCode to load the new tools."
