# this script is used to extract the dependencies from the app.json file and download them automatically
#
# required data:
# - app.json
# - Azure AD Client ID for development user
# - Azure AD Client Secret for development user

<#
.SYNOPSIS
    Gets the dependencies required for compiling a Business Central extension based on the extension's app.json
.DESCRIPTION
    Parses the app.json file in an extension and uses that information with the parameters to collect the packages required for compilation into an output directory.

    Requirements:
    - an application registration in Azure Entra, with the client id and client secret; it requires "app_access" and "API.ReadWrite.All" from the Business Central APIs
    - the application MUST ALSO be registered in Business Central as an Entra application with "EXTEN. MGT. - ADMIN" (at minimum)

    If the download returns a 500 despite valid authentication, the problem is likely either:
        - missing Business Central app registration permissions, or
        - incorrect/missing API permissions in Entra ID
.PARAMETER TenantId
    The Azure tenant id of the entity that is _compiling_ the extension, not the client's tenant id
.PARAMETER EnvironmentName
    The environment name of the Business Central environment being used to compile the extension, not the client environment name.  Default: 'sandbox'
.PARAMETER ClientId
    The client id that has been set up for this process to allow this script to log in to Business Central's API
.PARAMETER ClientSecret
    The client secret that has been set up for this process to allow this script to log in to Business Central's API
.PARAMETER PathToAppJson
    The file path to the app.json file.  Default "./.app.json"
.PARAMETER PathToPackagesDirectory
    The folder path to the output directory for packages.  Default "./.alpackages"
.PARAMETER TestLoginOnly
    Allows the script to test the login credentials and advise of results, without downloading packages
.NOTES
    Author  : James McCullough
    Company : Evergrowth Consulting
    Version : 1.0.0
    Created : 2025-05-21
    Purpose : DevOps-compatible symbol dependency resolution for AL extension builds
#>
function Get-BCDependencies {
    param(
        [Parameter(Mandatory)]
        [String]$TenantId,

        [Parameter()]
        [String]$EnvironmentName,

        [Parameter(Mandatory)]
        [String]$ClientId,

        [Parameter(Mandatory)]
        [String]$ClientSecret,

        [Parameter()]
        [String]$PathToAppJson,

        [Parameter()]
        [String]$PathToPackagesDirectory,

        [Parameter()]
        [Switch]$TestLoginOnly,

        [Parameter()]
        [Switch]$SkipDefaultDependencies

    )

    ########################################################################################################################################
    # Variable setups, assignments and confirmations
    ########################################################################################################################################

    # determine if the helper function exists, if not show a warning
    if (-not (Get-Command -Name "Add-BaseDependenciesIfMissing" -CommandType Function -ErrorAction SilentlyContinue) -and -not $SkipDefaultDependencies) {
        Write-Warning "The function Add-BaseDependenciesIfMissing is not loaded.  It is highly recommended that the user use this function"
        Write-Warning "to add dependencies that are normally missing from build scenarios."
        $SkipDefaultDependencies = $true
    }

    # Test the path first to ensure that it can find and parse app.json

    if (-not $PathToAppJson) {
        $appJSONFile = ".\app.json"
    }
    else {
        $appJSONFile = Join-Path -Path $PathToAppJson -ChildPath "app.json"
    }

    Write-Verbose "appJSONFile: $appJSONFile"    

    if (-not (Test-Path -Path $appJSONFile)) {
        throw "app.json not found at '$appJSONFile'; exiting..."
    } else {
        Write-Verbose "confirmed existence of app.json file at $appJSONFile"
    }

    Write-Verbose "starting parsing app.json"

    $appJSON = Get-Content -Raw $appJSONFile | ConvertFrom-Json

    Write-Verbose "converted app.json; confirming now"

    Write-Host "Found the following before validation routine:"
    $appJsonExists = if ($appJSON) {"true"} else {"false"}
    Write-Host ("  {0,-30} = {1}" -f "app.json exists", $appJsonExists)
    Write-Host ("  {0,-30} = {1}" -f "app.id", $appJSON.id)
    Write-Host ("  {0,-30} = {1}" -f "app.name", $appJSON.name)
    Write-Host ("  {0,-30} = {1}" -f "app.publisher", $appJSON.publisher)

    if (-not $appJSON -or -not $appJSON.id -or -not $appJSON.name -or -not $appJSON.publisher) {
        throw "app.json found at '$appJSONFile' does not appear to be valid; exiting..."
    }

    Write-Host "app.json loaded from '$appJSONFile' with name $($appJSON.name) published by $($appJSON.publisher)"

    if (-not $SkipDefaultDependencies) { $appJSON = Add-BaseDependenciesIfMissing -AppJSON $appJSON }

    Write-Host "Collecting $(($appJSON.dependencies | Measure-Object).Count) dependencies"

    # Test the path to the packages output directory (if specified, default if not), create it if it doesn't exist

    if (-not $PathToPackagesDirectory) {
        $targetPackageDirectory = Join-Path -Path $PathToAppJson -ChildPath ".alpackages"
    }
    else {
        $targetPackageDirectory = $PathToPackagesDirectory
    }

    if (-not (Test-Path -Path $targetPackageDirectory)) {
        New-Item -ItemType Directory -Path $targetPackageDirectory
        Write-Host "Created package directory at: '$($targetPackageDirectory)'"
    }
    else {
        Write-Host "Found output directory at: '$($targetPackageDirectory)'"
    }

    # set environment name to default if it is missing

    if (-not $EnvironmentName) {
        $EnvironmentName = "sandbox"
    }

    # variable assignments for setup; note: variables with '%_foo_%' are replaced internally within context of this script, not by an external tool

    $authurl = "https://login.microsoftonline.com/$($TenantId)/oauth2/v2.0/token"
    $scope = "https://api.businesscentral.dynamics.com/.default"

    $publisherToken = "%_PUBLISHER_%"
    $appNameToken = "%_APP_NAME_%"
    $versionToken = "%_VERSION_TEXT_%"
    $appIDToken = "%_APP_ID_%"

    $originSite = "https://api.businesscentral.dynamics.com/v2.0/$($EnvironmentName)/dev/packages?publisher=$($publisherToken)&appName=$($appNameToken)&versionText=$($versionToken)&appId=$($appIDToken)"

    $authBody = "grant_type=client_credentials&client_id=$ClientId&client_secret=$ClientSecret&scope=$scope"
    
    ########################################################################################################################################
    # Action section starts here
    ########################################################################################################################################

    # First things first, kill the progress bar because it interferes with logs
    $ProgressPreference = 'SilentlyContinue'

    # get token for login
    try {

        $tokenResponse = Invoke-RestMethod -Method Post -Uri $authurl -Body $authBody -ContentType "application/x-www-form-urlencoded"

        # Extract the token from the response
        $token = $tokenResponse.access_token 

        $authSuccess = $true
        "Authenticated correctly; moving on"
    }
    catch {
        Write-Host "Error: $($_.Exception.Message)" 
        $authSuccess = $false
        "ERROR - Authentication failed"
    }

    if ($TestLoginOnly) {
        if ($authSuccess) {
            Write-Host "TestLoginOnly specified and was successful; exiting normally..."
            return
        }
        else {
            Write-Host "TestLoginOnly specified and failed; exiting with error..."
            throw "Authentication failed"
        }
    }
    else {
        if (-not $authSuccess) {
            throw "Authentication failed; exiting"
        }
    }

    # these are the dependencies listed; we still need to grab the base system and the application itself, listed by "platform" and "application" in app.json
    foreach ($dependency in $appJSON.dependencies) {
        $siteID = $originSite.Replace($publisherToken, $dependency.publisher).Replace($appNameToken, [System.Web.HttpUtility]::UrlEncode($dependency.name)).Replace($versionToken, $dependency.version).Replace($appIDToken, $dependency.id)
        try {
            $response = Invoke-WebRequest $siteID -Headers @{"Authorization" = "Bearer " + $token }
        }
        catch {
            Write-Error "Failed to download symbol for $AppName $Version ($Publisher). $($_.Exception.Message)"
            throw
        }
        $responseHeaderCD = $response.Headers['Content-Disposition']
        $disposition = [System.Net.Mime.ContentDisposition]::new($responseHeaderCD)
        [IO.File]::WriteAllBytes($targetPackageDirectory + "\" + $disposition.FileName, $response.Content)

        $appName = if (![string]::IsNullOrEmpty($dependency.appName)) { $dependency.appName } else { $dependency.name }
        Write-Host "Dependency $appName ($($dependency.id)) downloaded"
    }

    if ($IsLinux) { 
        Write-Host "Executing chmod to allow access for all of the extracted files"
        chmod -R 644 $$TopExtractedFolder 
    }

    ########################################################################################################################################
    # Internal function here
    ########################################################################################################################################  
}
