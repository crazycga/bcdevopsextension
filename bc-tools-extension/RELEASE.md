# Release Notes - BCBuildTasks Extension

- [Version: 0.1.7](#version-017)
- [Version: 0.1.6](#version-016)
- [Version: 0.1.5](#version-015)
    + [Feature Release](#feature-release)
  * [New Features](#new-features)
    + [1. **EGGetBCCompanies**](#1-eggetbccompanies)
    + [2. **EGGetBCModules**](#2-eggetbcmodules)
    + [3. **EGDeployBCModule**](#3-egdeploybcmodule)
- [Version: 0.1.4](#version-014)
    + [Improvement Release](#improvement-release)
  * [New Features](#new-features-1)
    + [1. **EGGetALCompiler**](#1-eggetalcompiler)
    + [2. **EGGetALDependencies**](#2-eggetaldependencies)
    + [3. **EGBuildALPackage**](#3-egbuildalpackage)
  * [Notes & Requirements](#notes--requirements)
- [Version: 0.1.0](#version-010)
    + [Initial Release](#initial-release)
  * [New Features](#new-features-2)
    + [1. **EGGetALCompiler**](#1-eggetalcompiler-1)
    + [2. **EGGetALDependencies**](#2-eggetaldependencies-1)
    + [3. **EGBuildALPackage**](#3-egbuildalpackage-1)
  * [Notes & Requirements](#notes--requirements-1)
  * [Example Pipeline Usage](#example-pipeline-usage)
  * [Known Limitations](#known-limitations)
  * [Support](#support)

# Version: 0.1.7

## Fixes

- Fixed [#26](https://github.com/crazycga/bcdevopsextension/issues/26): Publish command not working correctly; should be fixed now.  
- Timeout command wasn't working properly, that has been fixed as well.  

## Improvements

- Added developer notes to the repo README.md.  
- Added possible errors and causal factors to README.md and VS Marketplace page.
- Prettified some of the output logs for `EGGetBCCompanies` and `EGGetBCModules`.
- Cleaned up some logging in `EGDeployBCModule`.

# Version: 0.1.6

- Addresses bug [#26](https://github.com/crazycga/bcdevopsextension/issues/26): Publish command not working correctly

# Version: 0.1.5

**Release Date:** 2025-06-03

--- 

### Feature Release

The 0.1.5 of this release has introduced some new features and functionality.  Some of this functionality, specifically `EGDeployBCModule` is still somewhat experimental and subject to future changes.

## New Features

### 1. **EGGetBCCompanies**

This will provide the user with a list of the Business Central companies in a tenant, along with their company id.  A sample output:

```
Companies:
1. CRONUS USA, Inc. (ID: fb615954-ba2b-f011-9af4-6045bdc89d67)
2. My Company (ID: 6f52db6a-ba2b-f011-9af4-6045bdc89d67)
```

At the time of this release, this routine does not provide an output variable.

### 2. EGGetBCModules

This will provide the user with a list of the installed modules in a Business Central tenant.

At the time of this release, this routine does not provide an output variable.

### 3. EGDeployBCModule

Please ensure that you see the documentation in the Visual Studio Marketplace page on this routine prior to use.

This will attempt to publish an .app file into a tenant.  **This routine is still largely experimental, and feedback is welcomed.**

# Version: 0.1.4

**Release Date:** 2025-05-27

---

### Improvement Release

The 0.1.4 version of this release made some background wiring changes that allow for specific version targeting when getting the compiler, and some improvements in logging.  

---

## New Features

### 1. **EGGetALCompiler**

* Allows for selective version download of AL compiler from Visual Studio Marketplace
* Expanded logging for diagnostic purposes

### 2. **EGGetALDependencies**

* Expanded logging for diagnostic purposes

### 3. **EGBuildALPackage**

* Expanded logging for diagnostic purposes

## Notes & Requirements

* All tasks are **PowerShell3-based** and rely on **VstsTaskSdk**
* Tasks must run on **Windows agents only** (not cross-platform)
* I have plans to migrate to an agent platform agnostic routine, but it requires a great deal of refactoring

# Version: 0.1.0

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
