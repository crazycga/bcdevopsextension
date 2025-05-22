. "./function_Build-ALPackage.ps1"

Write-Host "Building AL Package:"
Write-Host "  ProjectPath        = $env:ProjectPath"
Write-Host "  OutAppFolder       = $env:OutAppFolder"
Write-Host "  PackageCachePath   = $env:PackageCachePath"
Write-Host "  ALEXEPathFolder    = $env:ALEXEPathFolder"
Write-Host "  EntireAppName      = $env:EntireAppName"

Build-ALPackage -EntireAppName $env:EntireAppName -BaseProjectDirectory $env:ProjectPath -PackagesDirectory $env:PackageCachePath -OutputDirectory $env:OutAppFolder -ALEXEPath $env:ALEXEPathFolder
