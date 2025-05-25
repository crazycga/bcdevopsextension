[CmdletBinding()]
param (
    [string]$Environment = "dev",
    [string]$ConfigPath = "_tasks/environments.json",
    [string]$BuildNumber,
    [switch]$DebugMode
)

Write-Host "Invoking Initialize_BuildContext with:"
foreach ($param in $PSCmdlet.MyInvocation.MyCommand.Parameters.GetEnumerator()) {
    $name = $param.Key
    $value = Get-Variable -Name $name -Scope Local -ErrorAction SilentlyContinue

    if ($null -ne $value) {
        Write-Host ("  {0,-20} = {1}" -f $name, $value.Value)
    } else {
        Write-Host ("  {0,-20} = <unset>" -f $name)
    }
}

$config = Get-Content $ConfigPath | ConvertFrom-Json
$envData = $config.$Environment
if (-not $envData) {
    Write-Error "Environment '$Environment' not defined in configuration file"
    exit 1
}
Write-Host "Creating version for environment '$($envData.Environment)'"

$version = $config.version
$versionString = "$($version.major).$($version.minor).$($version.patch).$($version.build)"
Write-Host "Injecting version number '$versionString'"

$vssPath = $envData.vssLocation
if (-not (Test-Path -Path $vssPath)) {
    Write-Host "Error: file not found in expected location: '$vssPath'"
    exit 1
} else {
    Write-Host "Working on file '$vssPath'"
}
$vss = Get-Content $vssPath | ConvertFrom-Json
$vss.id = "eg-bc-build-tasks$($envData.extensionSuffix)"
Write-Host ("  {0,-20} = {1}" -f "vss.id", $vss.id) 
$vss.name = "Business Central Build Tasks$($envData.extensionSuffix)"
Write-Host ("  {0,-20} = {1}" -f "vss.name", $vss.name) 
$vss.version = $versionString
Write-Host ("  {0,-20} = {1}" -f "vss.version", $vss.version)
$vss.galleryFlags = $envData.galleryFlags
foreach ($flag in $vss.galleryFlags){
    Write-Host ("  {0,-20} = {1}" -f "vss.galleryFlag", $flag)
} 
if (-not $DebugMode) {
    $vss | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $vssPath
    Write-Host "Updated VSS extension manifest at '$vssPath' with version '$versionString'"
} else {
    Write-Host "This is normally where I would save VSS extension manifest at '$vssPath' with version '$versionString'"
}

Write-Host "Task names: $($envData.tasks.PSObject.Properties.Name)"

foreach ($taskName in $envData.tasks.PSObject.Properties.Name){
    Write-Host "Working on task name $taskName"
    $task = $envData.tasks.$taskName
    Write-Host "$($task.location)"
    $taskPath = $task.location
    if (-not (Test-Path -Path $taskPath)) {
        Write-Error "Task path not found for $taskName at $taskPath; aborting"
        exit 1
    }
    $taskFile = Get-Content $taskPath | ConvertFrom-Json
    $taskFile.id = $task.taskGuid
    Write-Host ("  {0,-20} = {1}" -f "$taskName", "$($task.taskGuid)")
    $taskFile.version.major = $version.major
    $taskFile.version.minor = $version.minor
    $taskFile.version.patch = $version.patch
    Write-Host ("  {0,-20} = {1}" -f "task.major", "$($taskFile.version.major)")
    Write-Host ("  {0,-20} = {1}" -f "task.minor", "$($taskFile.version.minor)")
    Write-Host ("  {0,-20} = {1}" -f "task.patch", "$($taskFile.version.patch)")
    
    if (-not $DebugMode) {
        $taskFile | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $taskPath
        Write-Host "Updated VSS task.json manifest at '$taskPath' with new id '$($task.taskGuid)'"
    } else {
        Write-Host "This is where I would normally update VSS task.json manifest at '$taskPath' with new id '$($task.taskGuid)'"
    }
}

Write-Host "Completed injections successfully; end of script"