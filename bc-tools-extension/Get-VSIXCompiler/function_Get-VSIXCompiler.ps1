<#
.SYNOPSIS
    [WINDOWS ONLY] This function is used to collect the latest version of the ms-dynamics-smb.al package from the Visual Studio Marketplace, decompress it, 
    and return the directory reference
.DESCRIPTION
    [WINDOWS ONLY]
    The function goes out to the web and collects the version information from the web, then subsequently uses that information to download the actual copy of 
    the .VSIX file from the marketplace API.  It then renames the file as a .zip file, and extracts it to a directory, then provides the directory and version
    as a response.  This is a Windows only routine, as it relies upon DOM to parse the response on the first query (as though it were a user.)  This is
    required because the actual website responds with a series of JS and other reactive components, and ms-dynamics-smb.al is not listed in the marketplace
    query API.
.PARAMETER downloadDirectory
    The directory in which to stage the artifacts that are being downloaded; the routine will automatically place the decompiled result in this directory with
    a subdirectory of "/expanded"
.OUTPUTS
    PSCustomObject containing ALEXEPath (the path to the decompiled file) and Version (the version of the decompiled file)
.NOTES
    SEE DESCRIPTION FOR WINDOWS ONLY REQUIREMENT
    Author  : James McCullough
    Company : Evergrowth Consulting
    Version : 1.0.0
    Created : 2025-05-21
    Purpose : DevOps-compatible AL extension download and decompression
#>
function Get-VSIXCompiler {
    param(
        [Parameter(Mandatory)]
        [String]$downloadDirectory
    )
    # sanity-check: is the user feeling okay?

    if (-not (Test-Path -Path $downloadDirectory)){
        throw "The directory $downloadDirectory does not exist; please specify an existing directory";
    }

    # Initialize variables
    $coreUrl = "https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al"
    $downloadUrlPrototype = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-dynamics-smb/vsextensions/al/%VERSION%/vspackage"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $targetPackageDirectory = $downloadDirectory
    $targetExpansionSubdirectory = Join-Path -Path $targetPackageDirectory -ChildPath "expanded"

    $ProgressPreference = 'SilentlyContinue'

    # Step 1: Get version information and session cookie
    try {
        $webrequest = Invoke-WebRequest -Uri $coreUrl -SessionVariable websession

        $HTML = New-Object -Com "HTMLFile"
        [string]$htmlBody = $webrequest.Content
        $HTML.Write([ref]$htmlBody)

    }
    catch {
        Write-Host "An error occurred during the attempt to resolve the latest version: $($_.Exception.Message)"
        throw
    }

    $VSIXRefs = $HTML.scripts | Where-Object className -eq "jiContent" | Select-Object -ExpandProperty innerHTML | ConvertFrom-Json

    if (-not $VSIXRefs -or -not $VSIXRefs.Resources) {
        Write-Host "Was unable to resolve the VSIX references required; exiting with error"
        throw "Unable to resolve VSIX references"
    }

    Write-Host "Found VSIX reference for $($VSIXRefs.Resources.ExtensionName) with a version number $($VSIXRefs.Resources.Version)"

    $downloadUrl = $downloadUrlPrototype.Replace("%VERSION%", $VSIXRefs.Resources.Version)
    Write-Host "Downloading from $downloadUrl"

    # Step 2: Attempt to download the target file
    try {
    $response = Invoke-WebRequest -Uri $downloadurl -WebSession $websession
    }
    catch {
        Write-Host "An error occurred trying to download the actual package from $downloadUrl"
        Write-Host "The error: $($_.Exception.Message)"
        throw
    }

    $responseHeaderCD = $response.Headers['Content-Disposition']
    $disposition = [System.Net.Mime.ContentDisposition]::new($responseHeaderCD)
    $dispositionFilePath = Join-Path -Path $targetPackageDirectory -ChildPath $disposition.FileName
    [IO.File]::WriteAllBytes($dispositionFilePath, $response.Content)

    Write-Host "Downloaded $($disposition.FileName): $($response.RawContentLength) bytes"

    # Step 3: Rename file because Azure Pipelines' version of Expand-Archive is a little b****
    $newFileName = "$($disposition.FileName).zip"
    Rename-Item -Path $dispositionFilePath -NewName $newFileName -Force
    $dispositionFilePath = $dispositionFilePath + ".zip"

    # Step 4: Expand .vsix file to file system to extract ALC.EXE
    $downloadedFile = $dispositionFilePath
    $expansionPath = $targetExpansionSubdirectory
    New-Item -ItemType Directory -Path $expansionPath -Force | Out-Null

    Expand-Archive -Path $downloadedFile -DestinationPath $expansionPath -Force

    # Step 5: Finish
    $ALEXEPath = Join-Path -Path $expansionPath -ChildPath (Join-Path -Path "extension" -ChildPath "bin")
    Write-Host "Routine complete; ALC.EXE should be located at $ALEXEPath"
    Write-Host "Returning ALEXEPath from to function call"
    
    return [PSCustomObject]@{
        ALEXEPath = $ALEXEPath
        Version   = $VSIXRefs.Resources.Version
    }
}
