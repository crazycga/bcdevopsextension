const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PassThrough } = require('stream');
const { logger, parseBool, getToken, normalizePath } = require(path.join(__dirname, '_common', 'CommonTools.js'));

let produceFile = parseBool(process.env.INPUT_PRODUCEFILE);
const inputFilenameAndPath = process.env.INPUT_FILENAMEANDPATH;

// this routine is intended to provide information about the agent on which it is running
//
// 1. platform
// 2. whoami
// 3. current working directory
// 4. Powershell version(s)
// 5. BCContainerHelper existence / version
// 6. Docker existence / version
// 7. Docker image list

(async () => {
    let outputFilenameAndPath;
    if (produceFile) {
        if (inputFilenameAndPath && inputFilenameAndPath != '') {
            outputFilenameAndPath = normalizePath(inputFilenameAndPath);
            let pathInfo = path.parse(outputFilenameAndPath);

            let outputPath = pathInfo.dir;
            let outputName = pathInfo.base;

            if (!outputName || !outputPath) {
                logger.warn(`Requested a file output, but cannot parse the file name and path '${outputFilenameAndPath}'`);
                produceFile = false;
                logger.info(`Setting ProduceFile to ${produceFile}`);
            }
        } else {
            logger.warn(`Requested a file output, but no file name and path was supplied in 'FilenameAndPath'`);
            produceFile = false;
            logger.info(`Setting ProduceFile to ${produceFile}`);
        }
    }

    logger.info('Invoking EGEnumerateEnvironment with the following parameters:');
    logger.info('ProduceFile:'.padStart(2).padEnd(30) + `${produceFile}`);
    logger.info('');
    
    // 0. setup
    const logColWidth = 30;

    // 1. platform    
    logger.info('[platform]:'.padEnd(logColWidth) + `${os.platform()}`);
    
    // 2. whoami
    let textOut;    
    try {
        let whoami = execSync('whoami', { encoding: 'utf8'});
        textOut = whoami.toString().trim();
        if (textOut.length > 0) {
            logger.info('[whoami]: '.padEnd(logColWidth) + `${textOut}`);
        } else {
            logger.info('[whoami]:'.padEnd(logColWidth) + 'Apparently a ghost; nothing returned');
        }
    } catch (err) {
        logger.error(`[whoami]: Encountered an error while executing a 'whoami'`);
        logger.error(`[whoami]: Error: ${err}`);
    }

    // 3. current working directory
    logger.info('[current working directory]:'.padEnd(logColWidth) + `${process.cwd()}`);

    // 4. Powershell version(s)
    let psVersion;
    let pwshVersion;
    if (os.platform() === "win32") {
        try {
            psVersion = execSync(
                `powershell -NoProfile -Command "$v = $PSVersionTable.PSVersion; Write-Output ('' + $v.Major + '.' + $v.Minor + '.' + $v.Build + '.' + $v.Revision)"`,
                { encoding: 'utf8' }
            ).trim();
            logger.info('[powershell version]:'.padEnd(logColWidth) + `${psVersion}`);
        } catch (err) {
            logger.error(`[powershell version]: Encountered an error while executing a 'powerhsell version'`);
            logger.error(`[powershell version]: Error: ${err}`);
        }
    } else {
        psVersion = "[not installed; Linux environment]";
        logger.info('[powershell version]:'.padEnd(logColWidth) + `${psVersion}`);
    }

    try {
        const isLinux = process.platform === 'linux';

        const psCommandRaw = '$PSVersionTable.PSVersion.ToString()';
        const psCommand = isLinux
            ? psCommandRaw.replace(/(["\\$`])/g, '\\$1')  // escape for bash
            : psCommandRaw;  // don't escape on Windows
        const fullCommand = `pwsh -NoProfile -Command "${psCommand}"`;
        //const quotedCommand = `"${psCommand.replace(/"/g, '\\"')}"`;
        pwshVersion = execSync(fullCommand, { encoding: 'utf8' }).trim();
        logger.info('[pwsh version]:'.padEnd(logColWidth) + `${pwshVersion}`);
    } catch (err) {
        logger.error(`[pwsh version]: Encountered an error while executing a 'pwsh version'`);
        logger.error(`[pwsh version]: Error: ${err}`);
    }

    // 5. BCContainerHelper existence / version
    let result;
    let BCContainerHelperPresent = false;

    if (os.platform() === "win32") {
        try {
            const psCommand = `$modulePath = Get-Module -ListAvailable BCContainerHelper | Select-Object -First 1 -ExpandProperty Path; if ($modulePath) { $psd1 = $modulePath -replace '\\[^\\\\]+$', '.psd1'; if (Test-Path $psd1) { $lines = Get-Content $psd1 -Raw; if ($lines -match 'ModuleVersion\\s*=\\s*[\\"\\'']?([0-9\\.]+)[\\"\\'']?') { Write-Output $matches[1]; } else { Write-Output '[version not found]'; } } else { Write-Output '[not installed]'; } } else { Write-Output '[not installed]'; }`;

            result = execSync(`powershell.exe -NoProfile -Command "${psCommand.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            if (result === "") { result = '[not installed]'}
            if (result && result != "") {
                logger.info('[BCContainerHelper version]:'.padEnd(logColWidth) + `${result}`);
                BCContainerHelperPresent = true;
            }
            BCContainerHelperPresent = true;
        } catch (err) {
            logger.error(`[BCContainerHelper]: Failed to query module: ${err.message}`);
            logger.info(err);
        }    
    } else {
        result = "[not installed; Linux environment]";
        logger.info('[BCContainerHelper version]:'.padEnd(logColWidth) + `${result}`);
    }

    // 6. Docker existence / version
    let DockerPresent = false;
    let DockerVersionResult;
    try {
        DockerResult = execSync('docker version --format "{{.Client.Version}}"', { stdio: ['pipe', 'pipe', 'pipe'] });
        if (DockerResult === "") { DockerVersionResult = '[not installed]'}
        else { DockerVersionResult = DockerResult.toString().trim(); }
        if (DockerVersionResult && DockerVersionResult != "") {
            logger.info('[dockerversion]:'.padEnd(logColWidth) + `${DockerVersionResult}`);
            DockerPresent = true;
        }
    } catch (err) {
        const msg = err.message || '';
        const stderr = err.stderr?.toString() || '';

        const combined = `${msg}\n${stderr}`;
        const normalized = combined.toLowerCase();
        if (
            normalized.includes("'docker' is not recognized") ||    // Windows case
            normalized.includes("command not found") ||             // Linux case
            normalized.includes("no such file or directory")        // fallback
        ) {
            DockerVersionResult = '[not installed]';
            if (DockerVersionResult && DockerVersionResult != "") {
                logger.info('[dockerversion]:'.padEnd(logColWidth) + `${DockerVersionResult}`);
            }
        } else {
            logger.error(`[dockerversion]: Unexpected error: ${combined}`);
        }
    }

    // 7. Docker image list
    let DockerPsObject;
    if (DockerPresent) {
        try {
            const psResult = execSync('docker ps -a --no-trunc --format "{{json .}}"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
            const lines = psResult.trim().split('\n');
            DockerPsObject = lines.map(line => JSON.parse(line));
            
            if (DockerPsObject.length > 0) {
                logger.info('[dockerimage]:'.padEnd(logColWidth) + '**Name**'.padEnd(logColWidth) + '**Status**');
                DockerPsObject.forEach((image, idx) => {
                    if (image && image.name != "") {
                        logger.info('[dockerimage]:'.padEnd(logColWidth) + `${image.Names}`.padEnd(logColWidth) + `${image.Status}`);
                    }
                });
            } else {
                logger.info('[dockerimage]:'.padEnd(logColWidth) + '[no images]');
            }
        } catch (err) {
            const msg = err.message || '';
            const stderr = err.stderr?.toString() || '';

            const combined = `${msg}\n${stderr}`;            
            logger.error(`[dockerimage]: Unexpected error: ${combined}`);
        }
    } else {
        logger.info('[dockerimage]:'.padEnd(logColWidth) + '[not installed]');
    }

    // Deal with the file if requested (note it has already been parsed at the top of this routine)
    if (produceFile) {

        let dockerList = [];
        try {
            dockerList = DockerPsObject.filter(img => img && img.Names).map(img => ({ name: img.Names, status: img.Status }));
        } catch {
            dockerList = [];
        }

        let candidateFile = {
            platform: os.platform(),
            whoami: textOut,
            workingDirectory: process.cwd(),
            powershellVersion: psVersion,
            pscoreVersion: pwshVersion,
            bcContainerVersion: result,
            dockerVersion: DockerVersionResult,
            dockerImages: dockerList
        }

        let candidateFileString = JSON.stringify(candidateFile);
        fs.writeFileSync(outputFilenameAndPath, candidateFileString);
    
        logger.info('');
        logger.info(`Produced file at: ${outputFilenameAndPath}`);
    }
})();