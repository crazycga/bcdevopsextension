<#
.SYNOPSIS
    [WINDOWS ONLY] This function actually builds the AL package based on the inputs.
.DESCRIPTION
    [WINDOWS ONLY]
    This function invokes the AL compiler and compiles the project based on the inputs.  This function assumes that the user has already
    run the previous two functions 'Get-VSIXCompiler' and 'Get-BCDependencies'.  If the inputs are blank, no compilation will occur.  It 
    produces an .app file at the specified location.  **It is up to the user to supply a properly versioned application name.**
.PARAMETER EntireAppName
    This is the output name of the compiled product, with ".app" appended to it.  i.e. "TestProject.1.1.1" will become "TestProject.1.1.1.app"
.PARAMETER BaseProjectDirectory
    This is the TOP LEVEL directory of your .al source code.  The system will enumerate all folders underneath this one to compile the project
.PARAMETER PackagesDirectory
    This is the directory that contains the already-downloaded .app files used in compilation.
.PARAMETER OutputDirectory
    This is the destination folder of the .app file.
.PARAMETER ALEXEPath
    This is the path to the folder ABOVE the ALC.EXE folder.  It will automatically drill into the 'win32' folder in this directory.  This
    reference is returned by "Get-BCDependencies" in $foo.ALEXEPath.
.OUTPUTS
    The path and file name of the compiled application.
.NOTES
    SEE DESCRIPTION FOR WINDOWS ONLY REQUIREMENT
    Author  : James McCullough
    Company : Evergrowth Consulting
    Version : 1.0.0
    Created : 2025-05-21
    Purpose : DevOps-compatible AL extension compiler invocation    
#>
function Build-ALPackage {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [String]$EntireAppName,

        [Parameter(Mandatory)]
        [String]$BaseProjectDirectory,

        [Parameter()]
        [String]$PackagesDirectory,

        [Parameter(Mandatory)]
        [String]$OutputDirectory,

        [Parameter(Mandatory)]
        [String]$ALEXEPath
    )

    try {
        $alcPath = Join-Path -Path $ALEXEPath -ChildPath "win32"
        $alcReference = Join-Path -Path $alcPath -ChildPath "ALC.EXE"
    }
    catch {
        throw "An error occurred; it doesn't seem that $alcPath contains a folder called 'win32', or the folder $alcPath\win32 doesn't contain ALC.EXE"
    }
    
    if (-not (Test-Path -Path $alcReference)){
        throw "ALC.EXE not found in $alcPath"
    } else {
        Write-Host "Found ALC.EXE at $alcPath"
    }

    if (-not (Test-Path -Path $PackagesDirectory)) {
        throw "Cannot find packages directory: $PackagesDirectory"
    } else {
        Write-Host "Confirmed packages directory: $PackagesDirectory"
        Write-Host "Checking for *.app files"
        if (-not (Get-ChildItem -Path $PackagesDirectory -Filter *.app)) {
            throw "Found packages directory, but no packages in it"
        }
    }

    if (-not $EntireAppName.EndsWith(".app")) {
        throw "Invalid app name (must end with '.app'): $EntireAppName"
    }

    if (-not (Test-Path -Path $BaseProjectDirectory)) {
        throw "Cannot find path $BaseProjectDirectory"
    }

    if (-not (Test-Path -Path $OutputDirectory)) {
        Create-Item -ItemType Directory $OutputDirectory
        Write-Host "Created directory: $OutputDirectory"
    } else {
        Write-Host "Confirmed output directory: $OutputDirectory"
    }    

    $OutputFile = Join-Path -Path $OutputDirectory -ChildPath $EntireAppName

    & $alcReference /project:"$BaseProjectDirectory" /out:"$OutputFile" /packagecachepath:"$PackagesDirectory"

    if ($LASTEXITCODE -ne 0) {
        throw "ALC compilation failed with exist code $LASTEXITCODE"
    }

    if (-not (Test-Path -Path $OutputFile)) {
        throw "Something went wrong; there is no file at $OutputFile"
    } else {
        Write-Host "Package created at $OutputFile"
    }

    return $OutputFile
}