param(
    [string]$SshTarget = 'root@aros-vps',
    [string]$Ref = 'HEAD'
)

$ErrorActionPreference = 'Stop'
$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { throw 'Run this command from the AROS git repository.' }
Set-Location $repo

$dirty = git status --porcelain
if ($dirty) {
    throw 'The working tree must be clean. Commit the exact release snapshot first.'
}

git rev-parse --verify "$Ref^{commit}" *> $null
if ($LASTEXITCODE -ne 0) { throw "Unknown git ref: $Ref" }
$bundleRef = (git rev-parse --symbolic-full-name $Ref).Trim()
if (-not $bundleRef) { $bundleRef = $Ref }
if ($bundleRef -notmatch '^refs/[A-Za-z0-9._/-]+$') {
    throw "Ref must resolve to a named branch or tag: $Ref"
}

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$bundle = Join-Path $env:TEMP "aros-direct-$stamp.bundle"
$remoteBundle = "/tmp/aros-direct-$stamp.bundle"
$remoteScript = "/tmp/aros-deploy-bundle-$stamp.sh"

try {
    git bundle create $bundle $Ref
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create release bundle.' }

    scp $bundle "${SshTarget}:$remoteBundle"
    scp (Join-Path $repo 'deploy/hostinger/deploy-bundle.sh') "${SshTarget}:$remoteScript"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to upload the release bundle.' }

    ssh $SshTarget "sed -i 's/\r$//' '$remoteScript' && chmod 700 '$remoteScript' && bash '$remoteScript' '$remoteBundle' '$bundleRef'"
    if ($LASTEXITCODE -ne 0) { throw 'Remote deployment failed or rolled back.' }

    # app.aros.live is the deployed platform on :5457; aros.live is the
    # separate public/marketing service and cannot validate this release.
    $response = Invoke-WebRequest -Uri 'https://app.aros.live/readyz' -Method Get `
        -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "Public health check returned HTTP $($response.StatusCode)."
    }
    Write-Host "AROS direct deployment passed: $Ref -> https://app.aros.live"
}
finally {
    Remove-Item -LiteralPath $bundle -Force -ErrorAction SilentlyContinue
    ssh $SshTarget "rm -f '$remoteBundle' '$remoteScript'" 2>$null | Out-Null
}
