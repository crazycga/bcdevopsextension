# Release Notes - BCBuildTasks Extension

## Version: 0.1.0

**Release Date:** 2025-05-22

---

### Initial Release

The 0.1.0 release of the **BCBuildTasks** extension for Azure DevOps introduces a complete set of Business Central AL build tools, designed for integration with CI/CD pipelines on Windows-based agents.

---

## New Features

### 1. **EGGetALCompiler**

* Downloads the latest version of the AL compiler from Visual Studio Marketplace
* Expands the VSIX package and exposes:

  * `alVersion`: AL compiler version number
  * `alPath`: Path to `alc.exe` for reuse by other tasks
* Output path structure clarified for downstream compatibility

### 2. **EGGetALDependencies**

* Connects to Business Central using Azure Entra credentials
* Downloads all required dependencies listed in `app.json`
* Optional switches:

  * `TestLoginOnly` - verifies login credentials only
  * `SkipDefaultDependencies` - avoids downloading base system packages

### 3. **EGBuildALPackage**

* Invokes `alc.exe` to compile an AL extension from source
* Fully supports variable paths for:

  * Project root
  * Package cache
  * Output `.app` file
* Produces `.app` in a CI-friendly `drop/` artifact directory

---

## Notes & Requirements

* All tasks are **PowerShell3-based** and rely on **VstsTaskSdk**
* Tasks must run on **Windows agents only** (not cross-platform)
* Requires Azure Entra app registration with permission to read BC metadata

---

## Example Pipeline Usage

```yaml
- task: EGGetALCompiler@0
  inputs:
    DownloadDirectory: '$(Build.SourcesDirectory)/compiler'

- task: EGGetALDependencies@0
  inputs:
    TenantId: '$(tenantId)'
    ClientId: '$(clientId)'
    ClientSecret: '$(clientSecret)'
    EnvironmentName: 'sandbox'
    PathToAppJson: '$(Build.SourcesDirectory)/ClientPTE'
    PathToPackagesDirectory: '$(Build.SourcesDirectory)/.alpackages'

- task: EGBuildALPackage@0
  inputs:
    EntireAppName: 'TestApp.1.1.1'
    ProjectPath: '$(Build.SourcesDirectory)/ClientPTE'
    OutAppFolder: '$(Build.ArtifactStagingDirectory)'
    PackageCachePath: '$(Build.SourcesDirectory)/.alpackages'
    ALEXEPathFolder: '$(alPath)'

- task: PublishBuildArtifacts@1
  inputs:
    PathtoPublish: '$(Build.ArtifactStagingDirectory)'
    ArtifactName: 'drop'
```

---

## Known Limitations

* AL compiler always defaults to latest available unless pinned manually
* Extension assumes default folder structure of `win32` inside compiler path
* Not yet tested on self-hosted agent pools with network-level restrictions

---

## Support

Please open a GitHub issue at https://github.com/crazycga/bcdevopsextension/issues for queries or support.

---

## License

Released under the MIT License. Use freely, with attribution.
