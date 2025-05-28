
function ConvertFrom-DevopsPath {
    param([Parameter(Mandatory)][string]$Path)
    if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        return [System.IO.Path]::GetFullPath($Path.Replace('/', '\'))
    } elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        return [System.IO.Path]::GetFullPath($Path.Replace('/', '\'))
    } elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        return [System.IO.Path]::GetFullPath($Path)
    } else {
        return $null
    }
}

function Get-OSEnvironment {
    if ($PSVersionTable.PSEdition -eq 'Core' -and $env:OS -like '*Windows*') {
        return "win32"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        return "win"
    }
    elseif ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)) {
        return "linux"
    }
    else {
        return "unknown"
    }
}

