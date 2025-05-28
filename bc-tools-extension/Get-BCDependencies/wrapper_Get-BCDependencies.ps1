. "./function_Add-BaseDependenciesIfMissing.ps1"
. "./function_Get-BCDependencies.ps1"

$local_TestLoginOnly = Get-VstsInput -Name 'TestLoginOnly'
$local_SkipDefaultDependencies = Get-VstsInput -Name 'SkipDefaultDependencies'
$local_TenantId = Get-VstsInput -Name 'TenantId'
$local_EnvironmentName = Get-VstsInput -Name 'EnvironmentName'
$local_ClientId = Get-VstsInput -Name 'ClientId'
$local_ClientSecret = Get-VstsInput -Name 'ClientSecret'
$local_PathToAppJson = Get-VstsInput -Name 'PathToAppJson'
$local_PathToPackagesDirectory = Get-VstsInput -Name 'PathToPackagesDirectory'

$switchParams = @{}

if ($local_TestLoginOnly -eq 'true') {
        $switchParams["TestLoginOnly"] = $true
}

if ($local_SkipDefaultDependencies -eq 'true') {
        $switchParams["SkipDefaultDependencies"] = $true
}

$switchParams["TenantId"]                       = $local_TenantId
$switchParams["EnvironmentName"]                = $local_EnvironmentName
$switchParams["ClientId"]                       = $local_ClientId
$switchParams["ClientSecret"]                   = $local_ClientSecret
$switchParams["PathToAppJson"]                  = $local_PathToAppJson
$switchParams["PathToPackagesDirectory"]        = $local_PathToPackagesDirectory

Write-Host "Getting AL Dependencies:"
$switchParams.GetEnumerator() | ForEach-Object {
        if ($_.Key -eq "ClientSecret") {
                Write-Host ("  {0,-30} = {1}" -f $_.Key, "Are you nuts?")            
        }
        else {
                Write-Host ("  {0,-30} = {1}" -f $_.Key, $_.Value)
        }
}

Get-BCDependencies @switchParams