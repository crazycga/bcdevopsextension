const path = require('path');
const fs = require('fs');
const { stat } = require('fs');
const { logger, normalizePath } = require('CommonTools.js');

// {
//   "version": "1.2.3.456",
//   "branch": "main",
//   "buildId": 1234,
//   "environment": "Development",
//   "artifact": "CodeModule.app",
//   "testTarget": "LocalAgent",
//   "timestamp": "2025-06-14T14:12:00Z",
//   "includes": ["app.json", "SSRS/Report1.rdl", "metadata/permissions.json"]
// }

function GetAllFiles(dir, baseDir = dir) {
    let results = [];

    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, baseDir));
        } else {
            const relativePath = path.relative(baseDir, fullPath);
            results.push(relativePath);
        }
    }
    return results;
}


function GenerateManifestAtom(outputFile, version, branch, buildId, coreFileName, type, includePath) {
    // echo inputs to debug    
    const vars = { outputFile, version, branch, buildId, coreFileName, type, includePath };
    logger.debug('GenerateManifest called with the following parameters:');
    for (const [key, value] of Object.entries(vars)) {
        logger.debug(`[${key}]:`.padStart(2).padEnd(15) + `${value}`);
    }
    
    // validate that all variables exist
    for (const [key, value] of Object.entries(vars)) {
        if (!value || value === "") {
            let errorMessage = `No [${key}] detected; exiting [GenerateManifest]`;
            logger.debug(errorMessage);
            throw new Error(errorMessage);
        }
    }

    // restrict type to "app" or "test"
    if (!(type === "app" || type === "test")) {
        let errorMessage = `'${type}' is not a valid type of either 'app' or 'test'`;
        logger.debug(errorMessage);
        throw new Error(errorMessage);
    }

    // create path for output file
    let filePath = normalizePath(outputFile);
    let pathInfo = path.parse(filePath);
    let outputPath = pathInfo.dir;
    let outputName = pathInfo.base;

    if (!outputName || !outputPath) {
        let errorMessage = `Requested a file output, but cannot parse the file name and path '${outputFile}'`;
        throw new Error(errorMessage);
    }

    try {
        fs.mkdirSync(outputPath, { recursive: true });
    } catch (err) {
        let errorMessage = `Error trying to create filepath '${outputPath}' :: ${err}`;
        throw new Error(errorMessage);
    }

    // get list of files in 'includePath'
    let fileListIncludePath = GetAllFiles(includePath);

    let outputObject = {
        version: version,
        branch: branch,
        buildId: buildId,
        artifact: coreFileName,
        type: type,
        includes: fileListIncludePath
    }

    fs.writeSync(outputFile, JSON.stringify(outputObject));
    logger.info(`Wrote manifest to '${outputFile}'`);
}