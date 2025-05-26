function Expand-Folder {
    param(
        [Parameter(Mandatory)]
        [String]$FileName,
        [Parameter(Mandatory)]
        [String]$ExtractFolder,
        [Parameter()]
        [String]$TopExtractedFolder = "expanded"
    )
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    
    $extractionPath = Join-Path -Path (Split-Path $FileName) -ChildPath $TopExtractedFolder
    $targetPrefix = if ($ExtractFolder.EndsWith("/")) {
        $ExtractFolder
    } else {
        "$ExtractFolder/"
    }
    
    Write-Host "Expanding '$FileName' folder '$targetPrefix' to '$extractionPath'"

    $fs = [System.IO.File]::OpenRead($FileName)
    $zip = [System.IO.Compression.ZipArchive]::new($fs, [System.IO.Compression.ZipArchiveMode]::Read)
    
    try {
        $subfolder = Split-Path -Path $targetPrefix -Leaf

        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.StartsWith($targetPrefix)) {
            
                $relativePath = $entry.FullName.Substring($targetPrefix.Length)
                
                if (-not [string]::IsNullOrEmpty($relativePath)) {
                    $destpath = Join-Path -Path (Join-Path -Path $extractionPath -ChildPath $subfolder) -ChildPath $relativePath
         
                    $destDir = Split-Path -Path $destPath -Parent
                    if (-not (Test-Path $destDir)) {
                        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                    }
                    Write-Host "Extracting file: $entry"
                    $outStream = [System.IO.File]::Create($destPath)
                    $entry.Open().CopyTo($outStream)
                    $outStream.Close()
                }
            }
        }
    }
    catch {
        Write-Error "Error: $($_.Exception.Message)"
        exit 1
    }
    finally {
        $fs.Close()
    }

    if ($IsLinux) { 
        Write-Host "Executing chmod to allow access for all of the extracted files"
        chmod -R 755 $$TopExtractedFolder 
    }
}
