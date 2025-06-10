const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const { PassThrough } = require('stream');
const { usesUndici, logger, parseBool, getToken, normalizePath } = require(path.join(__dirname, '_common', 'CommonTools.js'));
const fetch = usesUndici();
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// helper function to find the compiler (can allow an array in targetname)
async function findCompiler(dir, targetname) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name.toLowerCase());

        const match = Array.isArray(targetname) ? targetname.some(t => fullPath.includes(t.toLowerCase())) : fullPath.includes(targetname.toLowerCase());
        
        if (entry.isDirectory()) {
            const result = await findCompiler(fullPath, targetname);
            if (result) return result;
        } else if (match) {
            return fullPath;
        }
    }
    return null;
}

// main function of script
(async () => {
    // collect variables from input
    const downloadDirectory = normalizePath(process.env.INPUT_DOWNLOADDIRECTORY);
    const downloadVersion = process.env.INPUT_VERSION;

    logger.info('Calling Get-VSIXCompiler with the following parameters:');
    logger.info('DownloadDirectory'.padStart(2).padEnd(30) + downloadDirectory);
    logger.info('Version'.padStart(2).padEnd(30) + downloadVersion);

    // confirm all variables exist
    const requiredInputs = { downloadDirectory, downloadVersion };
    for (const [key, value] of Object.entries(requiredInputs)) {
        if (!value) {
            logger.error(`Missing required input: ${key}`);
            process.exit(1);
        }
    }

    // confirm the download directory exists
    try {
        fs.mkdirSync(downloadDirectory, { recursive: true });
        logger.debug(`Confirmed or created the download directory at ${downloadDirectory}`);
    } catch (err) {
        logger.error(`An error occurred trying to confirm or create ${downloadDirectory}`);
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // discover platform and environment
    logger.debug(`Platform detected: ${os.platform()}`)
    const isWindows = os.platform() === "win32";
    logger.debug(`isWindows: ${isWindows}`);
    logger.debug(`Working directory: ${process.cwd()}`);

    // find latest (or specified) version
    let apiUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";
    logger.debug(`Contacting ${apiUrl}`);

    const jsonRawPrototype = {
        filters: [
            {
                criteria: [
                    {
                        filterType: 7,
                        value: "ms-dynamics-smb.al"
                    }
                ],
                pageNumber: 1,
                pageSize: 100,
                sortBy: 0,
                sortOrder: 0
            }
        ],
        assetTypes: [],
        flags: 129
    };

    logger.debug(`JSON body: ${JSON.stringify(jsonRawPrototype)}`);

    let versionResult;
    
    try {
        const versionResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json; charset=utf-8;api-version=7.2-preview.1',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonRawPrototype)
        });

        if (!versionResponse.ok) {
            logger.error('Something went wrong getting the version information');
            const text = await versionResponse.text();
            logger.debug(text);
            throw new Error('Version check failed');
        }

        versionResult = await versionResponse.json();
    } catch (err) {
        logger.error('Something went wrong while trying to get version information');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // prepare download link from information retrieved from the API
    const publisher = versionResult.results[0].extensions[0].publisher.publisherName;
    const extension = versionResult.results[0].extensions[0].extensionName;
    logger.info(`Received response from the API with ${versionResult.results[0].extensions[0].versions.length} versions for ${extension} by ${publisher}`);

    let version;
    if (downloadVersion === 'latest') {
        version = versionResult.results[0].extensions[0].versions[0].version;
    } else {
        const checkVersions = versionResult.results?.[0]?.extensions?.[0]?.versions ?? [];
        const versionExists = checkVersions.some(v => v.version === downloadVersion);
        if (versionExists) {
            version = downloadVersion;
            logger.info(`Confirmed version ${version} exists`);
        } else {
            logger.error(`Version ${downloadVersion} does not exist in the results; please verify and try again`);
            process.exit(1);
        }
    }

    logger.info('');
    logger.info('Acquiring compiler with the follow attributes:');
    logger.info('publisher'.padStart(2).padEnd(15) + publisher);
    logger.info('extension'.padStart(2).padEnd(15) + extension);
    logger.info('version'.padStart(2).padEnd(15) + version);
    logger.info('');

    const downloadUrl = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${extension}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;
    logger.debug(`Acquisition url: ${downloadUrl}`);

    // attempt download
    const downloadFilename = path.join(downloadDirectory, 'compiler.vsix');

    try {
        const downloadResponse = await fetch(downloadUrl);

        if (!downloadResponse.ok) { 
            logger.error(`Something went wrong downloading the compiler; got response code ${downloadResponse.status}: ${downloadResponse.statusText}`);
            process.exit(1);
        }

        // note: content-disposition does not contain a particularly logical, valid or stable filename...
        await pipeline(downloadResponse.body, fs.createWriteStream(downloadFilename));
        logger.info(`Downloaded file: ${downloadFilename}`);

        const fileBuffer = await fs.promises.readFile(downloadFilename);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        logger.info(`SHA256: ${hash}`);

    } catch (err) {
        logger.error('Something went wrong downloading the compiler');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // attempt to install unzipper
    let unzipper;

    try {
        unzipper = require('unzipper');
    } catch (_) {
        logger.info('Unzipper not found; attempting auto install');
        const projectRoot = path.resolve(__dirname, '..');
        const { execSync } = require('child_process');
        try {
            execSync('npm install unzipper --no-progress --loglevel=warn', {
                cwd: projectRoot,
                stdio: 'inherit'
            });
            unzipper = require('unzipper');
        } catch (installErr) {
            logger.error('Could not automatically acquire unzipper');
            logger.error(`Error: ${err.message}`);
            process.exit(1);
        }
    }

    // decompile
    const extractTo = path.join(downloadDirectory, 'expanded');

    logger.info(`Extracting ${downloadFilename} to ${extractTo}`);
    await fs.createReadStream(downloadFilename).pipe(unzipper.Extract( {path: extractTo })).promise();
    logger.info(`Extracted ${downloadFilename} to ${extractTo}`);

    // find alc / alc.exe and echo results
    
    const expectedCompilerName = isWindows ? 'alc.exe' : 'alc';
    logger.debug(`Searching for compiler ${expectedCompilerName}`);
    let actualALEXE = await findCompiler(extractTo, expectedCompilerName);

    if (actualALEXE) {
        logger.info(`Found compiler '${expectedCompilerName}' at '${actualALEXE}`);
        logger.info(`##vso[task.setvariable variable=alVersion;isOutput=true]${version}`);
        logger.info(`Set pipeline variable 'alVersion' to ${version}`);
        logger.info(`##vso[task.setvariable variable=alPath;isOutput=true]${actualALEXE}`);
        logger.info(`Set pipeline variable 'alPath' to ${actualALEXE}`);
    }
})();