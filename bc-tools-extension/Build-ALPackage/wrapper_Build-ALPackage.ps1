. "./function_Build-ALPackage.ps1"

$local_ProjectPath = Get-VstsInput -Name 'ProjectPath'
$local_OutAppFolder = Get-VstsInput -Name 'OutAppFolder'
$local_PackageCachePath = Get-VstsInput -Name 'PackageCachePath'
$local_ALEXEPathFolder = Get-VstsInput -Name 'ALEXEPathFolder'
$local_EntireAppName = Get-VstsInput -Name 'EntireAppName'

Write-Host "Building AL Package:"
Write-Host "  ProjectPath        = $local_ProjectPath"
Write-Host "  OutAppFolder       = $local_OutAppFolder"
Write-Host "  PackageCachePath   = $local_PackageCachePath"
Write-Host "  ALEXEPathFolder    = $local_ALEXEPathFolder"
Write-Host "  EntireAppName      = $local_EntireAppName"

Build-ALPackage -EntireAppName $local_EntireAppName -BaseProjectDirectory $local_ProjectPath -PackagesDirectory $local_PackageCachePath -OutputDirectory $local_OutAppFolder -ALEXEPath $local_ALEXEPathFolder
