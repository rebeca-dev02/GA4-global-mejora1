param(
  [string]$RemoteUrl = "https://github.com/rebeca-dev02/GA4-global-mejora1.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Publish current Dataform project snapshot",
  [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [string]$WorkingDirectory = $null
  )

  if ($WorkingDirectory) {
    & git -C $WorkingDirectory @Args
  } else {
    & git @Args
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($Args -join ' ')"
  }
}

function Remove-DirectorySafe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (Test-Path $Path) {
    cmd /c "rmdir /s /q ""$Path"""
    if (Test-Path $Path) {
      throw "Could not delete temporary directory: $Path"
    }
  }
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "This script must be run inside a Git repository."
}

Set-Location $repoRoot

$workingTreeStatus = (& git status --porcelain).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Could not read Git status."
}

if (-not [string]::IsNullOrWhiteSpace($workingTreeStatus)) {
  throw "Working tree is not clean. Commit or stash your changes before publishing."
}

$tempRoot = Join-Path $repoRoot ".tmp_publish_main_clean"
$publishRepo = Join-Path $tempRoot "repo"
$archivePath = Join-Path $tempRoot "snapshot.tar"

Remove-DirectorySafe -Path $tempRoot
New-Item -ItemType Directory -Path $publishRepo -Force | Out-Null

try {
  Invoke-Git -Args @("archive", "--format=tar", "HEAD", "-o", $archivePath)

  & tar -xf $archivePath -C $publishRepo
  if ($LASTEXITCODE -ne 0) {
    throw "Could not unpack Git archive into temporary repository."
  }

  Invoke-Git -Args @("init", "-b", "main") -WorkingDirectory $publishRepo

  $userName = (& git -C $repoRoot config user.name).Trim()
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($userName)) {
    Invoke-Git -Args @("config", "user.name", $userName) -WorkingDirectory $publishRepo
  }

  $userEmail = (& git -C $repoRoot config user.email).Trim()
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($userEmail)) {
    Invoke-Git -Args @("config", "user.email", $userEmail) -WorkingDirectory $publishRepo
  }

  Invoke-Git -Args @("add", ".") -WorkingDirectory $publishRepo
  Invoke-Git -Args @("commit", "-m", $CommitMessage) -WorkingDirectory $publishRepo
  Invoke-Git -Args @("remote", "add", "origin", $RemoteUrl) -WorkingDirectory $publishRepo
  Invoke-Git -Args @("fetch", "origin") -WorkingDirectory $publishRepo
  Invoke-Git -Args @("push", "--force-with-lease", "origin", "HEAD:$Branch") -WorkingDirectory $publishRepo

  Write-Host "Published clean snapshot to $RemoteUrl ($Branch)." -ForegroundColor Green
  Write-Host "Next step in Dataform: open the workspace, click Pull, then open Compiled graph."
}
finally {
  if (-not $KeepTemp) {
    Remove-DirectorySafe -Path $tempRoot
  }
}
