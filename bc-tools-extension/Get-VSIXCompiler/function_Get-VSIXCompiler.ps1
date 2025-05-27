function Get-VSIXCompilerVersion {
    param(
        [Parameter(Mandatory)]
        [String]$Version,
        [Parameter(Mandatory)]
        [String]$DownloadDirectory,
        [Parameter()]
        [Switch]$DebugMode
    )

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'

    Write-Host "Determining platform"
    if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        $platform = "win32"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        $platform = "win32"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        $platform = "linux"
    }
    else {
        Write-Error "Unsupported platform: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)"
        exit 1
    }
    
    Write-Host "Detected platform: $platform"
    
    $apiUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"
    
    Write-Host "Contacting '$apiUrl'"

    $jsonRawPrototype = [ordered]@{
        filters    = @(
            @{
                criteria   = @(
                    @{
                        filterType = 7
                        value      = 'ms-dynamics-smb.al'
                    }
                )
                pageNumber = 1
                pageSize   = 100
                sortBy     = 0
                sortOrder  = 0
            }
        )
        assetTypes = @()
        flags      = 129
    } | ConvertTo-Json -Depth 10

    try {
        $headers = @{"Accept" = "application/json; charset=utf-8;api-version=7.2-preview.1" }
        $restResult = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $jsonRawPrototype -ContentType "application/json" -Headers $headers
    }
    catch {
        Write-Error "An error occurred: $($_.Exception.Message)"
        exit 1
    }

    if (-not $restResult) {
        Write-Error "Something went wrong, didn't get a proper response from the API"
        exit 1
    }

    Write-Host "Received response from the API with $($restResult.results[0].extensions[0].versions.Count) versions coming back"

    $publisher = $restResult.results[0].extensions[0].publisher.publisherName
    $extension = $restResult.results[0].extensions[0].ExtensionName
    
    if ($Version -eq 'latest') {
        $getVersion = $restResult.results[0].extensions[0].versions[0].version
    }
    else {
        $versions = $restResult.results[0].extensions[0].versions
        $versionExists = $versions.version -contains $Version
        if ($versionExists) {
            $getVersion = $Version
        }
        else {
            Write-Error "Version $Version was not found in the list of versions; please check your version number or try 'latest'"
            exit 1
        }
    }

    Write-Host "Acquiring compiler with the following metadata:"
    Write-Host ("  {0,-20} = {1}" -f "publisher", $publisher)
    Write-Host ("  {0,-20} = {1}" -f "extension", $extension)
    Write-Host ("  {0,-20} = {1}" -f "version", $version)
    Write-Host ""
    
    $downloadUrl = "https://$($publisher).gallery.vsassets.io/_apis/public/gallery/publisher/$($publisher)/extension/$($extension)/$($getVersion)/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage"
    Write-Host "Acquisition: $downloadUrl"

    if (-not (Test-Path -Path $DownloadDirectory)) {
        New-Item -ItemType Directory -Path $DownloadDirectory
        Write-Host "Creating directory: $DownloadDirectory"
    }

    $target = Join-Path -Path $DownloadDirectory -ChildPath "compiler.vsix"
    Write-Host "Download target: $target"

    if (-not $DebugMode) {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $target -UseBasicParsing
        Write-Host "Downloaded file: $target"
    }

    # Step 3: Rename file because Azure Pipelines' version of Expand-Archive is a little b****
    $newFileName = "compiler.zip"
    $newPath = Join-Path -Path (Split-Path $target) -ChildPath $newFileName
    Rename-Item -Path $target -NewName $newPath -Force
    
    Write-Host "Renamed '$target' to '$newFileName' for unzipping"

    $expandFolder = Join-Path -Path $DownloadDirectory -ChildPath "expanded"
    Write-Host "Created folder '$expandFolder'"

    Write-Host "Extracting folder for '$platform' environment from VSIX to '$expandFolder'"
    try {
        Expand-Archive -Path $newPath -DestinationPath $expandFolder -Force
    } catch {
        Write-Error "Expand-Archive failed: $($_.Exception.Message)"
        exit 1
    }

    # Step 5: Finish
    $expectedEnvPath = if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        "win32"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        "win32"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        "linux"
    }

    $expectedCompilerName = if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        "alc.exe"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        "alc.exe"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        "alc"
    }

    $ALEXEPath = Join-Path -Path $expandFolder -ChildPath (Join-Path -Path "extension" -ChildPath (Join-Path -Path "bin" -ChildPath (Join-Path -Path $expectedEnvPath -ChildPath $expectedCompilerName)))

    Write-Host "########################################################################################################################################"
    Write-Host "Enumerating filesystem from '$expandFolder'"
    Write-Host "########################################################################################################################################"
    Write-Host ""
    Get-ChildItem -Path "$expandFolder" -Force -Recurse | %{$_.FullName}
    Write-Host ""
    Write-Host "########################################################################################################################################"

    Write-Host "Testing destination: $ALEXEPath"
    if (Test-Path -Path $ALEXEPath) {
        Write-Host "Routine complete; ALC[.EXE] should be located at $ALEXEPath"
        Write-Host "Returning ALEXEPath from to function call"
        
        return [PSCustomObject]@{
            ALEXEPath = $ALEXEPath
            Version   = $getVersion
        }
    } else {
        Write-Error "'$ALEXEPath' did not resolve to a correct location.  Enumerating file system for reference:"
        Write-Host ""
        Get-ChildItem -Path "$(Build.SourcesDirectory)" -Force -Recurse | %{$_.FullName}
    }
}