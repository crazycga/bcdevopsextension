Please see the README.md in bc-tools-extension: [README.md](./bc-tools-extension/README.md)

# Compilation Notes

## Superseded by Later Events

The problem indicated below has been superseded by events that came later.  Specifically, the issue can be resolved by:

1. do not refer to the file in `contents`
1. do not add the file in `files`
1. do not add a JSON property `overview`
1. put the screen contents in `contents`.`details`.`path` to the appropriate .md, such as:

```
"content": {
    "details": {
        "path": "README.md"
    },
```

## SUPERSEDED: ⚠️ Azure DevOps Marketplace Bug: `overview.md` Upload Failure

When publishing this extension to the [Azure DevOps Marketplace](https://marketplace.visualstudio.com/azuredevops), we encountered a **long-standing undocumented issue** with `tfx extension create`.

Even if you:

* Include `overview.md` in the root
* Set `"overview": "overview.md"` in `vss-extension.json`
* Add it to the `files[]` array with `"addressable": false`
* Use proper UTF-8 encoding, BOM-free

...the CLI will still fail to inject the required `<Asset>` element in `extension.vsixmanifest`.

### 🔥 The Result

Marketplace upload fails with:

```
Uploaded extension package is missing an 'overview.md' file which is a mandatory details asset.
```

### ✅ The Only Reliable Fix

Manually add this to your `.vsix` after building:

```xml
<Asset Type="Microsoft.VisualStudio.Services.Content.Details" d:Source="File" Path="overview.md" Addressable="false"/>
```

To do that:

1. Unzip the `.vsix`
2. Open `extension.vsixmanifest`
3. Add the `<Asset>` line inside the `<Assets>` block
4. Rezip the package and upload

This is the only proven workaround as of May 2025. See full investigation and issue:
[https://github.com/microsoft/tfs-cli/issues/402](https://github.com/microsoft/tfs-cli/issues/402)
