function ConvertFrom-DevopsPath {
    param([Parameter(Mandatory)][string]$Path)
    if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        return [System.IO.Path]::GetFullPath($Path.Replace('/', '\'))
    } elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        return [System.IO.Path]::GetFullPath($Path.Replace('/', '\'))
    } elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        return [System.IO.Path]::GetFullPath($Path)
    } else {
        return $null
    }
}

. "./function_Get-VSIXCompiler.ps1"
#. "./function_Expand-Folder.ps1"

$localDownloadDirectory = Get-VstsInput -Name 'DownloadDirectory' -Require
$localCompilerVersion = Get-VstsInput -Name 'Version' -Require

Write-Host "Getting AL Compiler:"
Write-Host ("  {0,-20} = {1}" -f "DownloadDirectory", $localDownloadDirectory)
Write-Host ("  {0,-20} = {1}" -f "Version", $localCompilerVersion)

Write-Host "Normalizing directory reference: $localDownloadDirectory"
$localDownloadDirectory = ConvertFrom-DevopsPath $localDownloadDirectory
Write-Host "Normalized  directory reference: $localDownloadDirectory"

$vsixResult = Get-VSIXCompilerVersion -DownloadDirectory $localDownloadDirectory -Version $localCompilerVersion

if (-not $vsixResult -or `
    [string]::IsNullOrWhiteSpace($vsixResult.Version) -or `
    [string]::IsNullOrWhiteSpace($vsixResult.ALEXEPath)) {

    Write-Error "Get-VSIXCompiler failed to return a valid Version and/or ALEXEPath."
    exit 1
}

Write-Host "Variable assignments being set:"
Write-Host ("  {0,-20} = {1}" -f "alVersion", $vsixResult.Version)
Write-Host "##vso[task.setvariable variable=alVersion;isOutput=true]$vsixResult.Version"
Write-Host ("  {0,-20} = {1}" -f "alPath", $vsixResult.ALEXEPath)
Write-Host "##vso[task.setvariable variable=alPath;isOutput=true]$vsixResult.ALEXEPath"
