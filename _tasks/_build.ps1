# this is required to copy the contents of the _common directory to the various subtask folders

###############################################################################################
# copy _common to all subfolders where _common is required
###############################################################################################

Set-Location -Path "./bc-tools-extension"

Write-Host "Current working directory: $(Get-Location)"

Write-Host "Copying _common contents to:"

$paths = @(
    "./Get-ListOfCompanies",
    "./Get-ListOfModules",
    "./Publish-BCModuleToTenant",
    "./Build-ALPackage",
    "./Get-BCDependencies"
)

foreach($path in $paths) {
    Write-Host ("  {0,20}" -f $path)
    $destPath = Join-Path -Path $path -ChildPath "_common"
    
    Write-Host "DestPath: $destPath"
    if (-not (Test-Path -Path $destPath)) {
        New-Item -ItemType Directory -Path $destPath | Out-Null
        Write-Host "Created path: $destPath"
    }
    #Copy-Item -Path "_common\*" -Destination "$destPath" -Recurse -Force
    Get-ChildItem -Path "_common" | Where-Object { $_.Name -ne "_build.ps1" } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
    }
    Write-Host "Copied '_common' to $path"
}

Write-Host "Copy complete"

###############################################################################################
