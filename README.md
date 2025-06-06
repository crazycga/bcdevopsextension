Please see the README.md in bc-tools-extension: [README.md](./bc-tools-extension/README.md)

# Compilation Notes

## Superseded by Later Events

The problem indicated in the `overview.md` has been superseded by events that came later.  Specifically, the `vss-extension.json` issue can be resolved by:

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

## Developer Notes

| Failure                                                                    | Likely Cause                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **StandardOut has not been redirected or the process hasn't started yet.** | This occurs when the PowerShell task in the pipeline is malformed — most often caused by **missing script content**, a **missing filePath**, or **bad path slashes** (especially `\` instead of `/` on Linux agents). It can also happen if the script crashes before the pipeline task properly starts.|
| **callNavUploadCommand appears to succeed, but nothing happens afterward** | The call to `Microsoft.NAV.upload` returns HTTP 200 even when it **fails silently**. You must follow up with polling and inspect the deployment status via `extensionDeploymentStatus` to detect actual success or failure.|
| **Polling loop exits after one check, even when status is 'InProgress'**| Caused by calling `response.json()` **twice** in `getInstallationStatus()`, which consumes the response body stream on the first call, leaving the second call empty. This results in undefined values or an early break.|
| **Version number updated, but deployment still fails** | Business Central may not recognize a new version string unless **major/minor/patch are also changed**. Changing only the build metadata (e.g., `1.0.0.123` → `1.0.0.124`) may be ignored depending on caching or database lag. Try bumping `1.0.1` instead.|
| **Multiple extensions in deployment status, loop picks wrong one**| The polling loop may pick the **wrong `operationId`** from `extensionDeploymentStatus` if you're not filtering by your own ID or name. Always prefer to filter by `operationId` if known. Otherwise, match by `name`, `publisher`, and `appVersion` to ensure accuracy. |
| **Pipeline script can't find `app.json`** | Caused by relying on `$(Build.SourcesDirectory)` without checking the actual folder layout. Paths can change depending on repo structure, multi-stage pipelines, or if `checkout: none` was accidentally set. Prefer dynamic resolution using recursive search and fail early if multiple matches are found. |
| **Upload call fails with 409 (Conflict)** | This means your `@odata.etag` is stale. Re-fetch the latest extension upload record before retrying the `upload` call. The `etag` is not durable across upload+retry attempts. |
| **'undici' not found** | Some agents may not have `undici` preinstalled. The script attempts auto-install, but this can fail due to **network restrictions**, **read-only agents**, or **restricted `npm` execution**. Make sure your agent allows install or prebundle `node_modules` if needed.|
