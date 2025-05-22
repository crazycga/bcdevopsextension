<#
.SYNOPSIS
    An internal tool used to add to the app.json for missing dependencies
.DESCRIPTION
    Conditionally adds (normally) missing required packages for compiling.  These include system, application, etc.
.PARAMETER AppJSON
    This expects the previously parsed app.json file.  Since this is an internal tool, it is on the user to ensure that it returns what is expected.
.OUTPUTS
    The same AppJSON with the dependencies added.
.NOTES
    Author  : James McCullough
    Company : Evergrowth Consulting
    Version : 1.0.0
    Created : 2025-05-21
    Purpose : DevOps-compatible AL extension internal tool to add dependencies
#>
function Add-BaseDependenciesIfMissing {
    param(
        [Parameter(Mandatory)]
        [PSCustomObject]$AppJSON
    )
    ########################################################################################################################################
    # These items are usually mandatory, and don't always appear in an app.json dependencies; load them if missing
    ########################################################################################################################################
    $baseDependencies = @(
        [PSCustomObject]@{
            id        = "63ca2fa4-4f03-4f2b-a480-172fef340d3f"
            name      = "System Application"
            publisher = "Microsoft"
            version   = ""
        },
        [PSCustomObject]@{
            id        = "f3552374-a1f2-4356-848e-196002525837"
            name      = "Business Foundation"
            publisher = "Microsoft"
            version   = ""
        },
        [PSCustomObject]@{
            id        = "437dbf0e-84ff-417a-965d-ed2bb9650972"
            name      = "Base Application"
            publisher = "Microsoft"
            version   = ""
        },
        [PSCustomObject]@{
            id        = "6f2c034f-5ebe-4eae-b34c-90a0d4e87687"
            name      = "_Exclude_Business_Events_"
            publisher = "Microsoft"
            version   = ""
        },
        [PSCustomObject]@{
            id        = "8874ed3a-0643-4247-9ced-7a7002f7135d"
            name      = "System"
            publisher = "Microsoft"
            version   = ""
        },
        [PSCustomObject]@{
            id        = "00000000-0000-0000-0000-000000000000"
            name      = "Application"
            publisher = "Microsoft"
            version   = ""
        }
    )

    if (-not $AppJSON.PSObject.Properties['dependencies']) {
        $AppJSON | Add-Member -MemberType NoteProperty -Name dependencies -Value @()
    }

    # Get existing dependency IDs once, cleanly
    $existingIds = $AppJSON.dependencies | Where-Object { $_.id } | ForEach-Object { $_.id }

    foreach ($baseDependency in $baseDependencies) {
        if ($baseDependency.id -notin $existingIds) {
            Write-Host "Adding dependency $($baseDependency.name) from $($baseDependency.publisher) to dependencies with guid $($baseDependency.id)"
            $AppJSON.dependencies += $baseDependency
        }
    }

    return $AppJSON
}
