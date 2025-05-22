. "./function_Add-BaseDependenciesIfMissing.ps1"
. "./function_Get-BCDependencies.ps1"

$switchParams = @{}

if ($env:TestLoginOnly -eq 'true') {
        $switchParams["TestLoginOnly"] = $true
}

if ($env:SkipDefaultDependencies -eq 'true') {
        $switchParams["SkipDefaultDependencies"] = $true
}

$switchParams["TenantId"]                       = $env:TenantId
$switchParams["EnvironmentName"]                = $env:EnvironmentName
$switchParams["ClientId"]                       = $env:ClientId
$switchParams["ClientSecret"]                   = $env:ClientSecret
$switchParams["PathToAppJson"]                  = $env:PathToAppJson
$switchParams["PathToPackagesDirectory"]        = $env:PathToPackagesDirectory

Write-Host "Getting AL Dependencies:"
$switchParams.GetEnumerator() | ForEach-Object {
        if ($_.Key -eq "ClientSecret") {
                Write-Host ("  {0,-20} = {1}" -f $_.Key, "Are you nuts?")            
        }
        else {
                Write-Host ("  {0,-20} = {1}" -f $_.Key, $_.Value)
        }
}

Get-BCDependencies @switchParams