const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const commonTools = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { logger } = require(path.join(__dirname, '_common', 'CommonTools.js'));

// collect variables from input
const entireAppName = process.env.INPUT_ENTIREAPPNAME;
const baseProjectDirectory = process.env.INPUT_PROJECTPATH;
const packagesDirectory = process.env.INPUT_PACKAGECACHEPATH;
const outputDirectory = process.env.INPUT_OUTAPPFOLDER;
const alcPath = process.env.INPUT_ALEXEPATHFOLDER;

logger.info('Calling Build-ALPackage with the following parameters:');
logger.info('EntireAppName'.padStart(2).padEnd(30) + entireAppName);
logger.info('BaseProjectDirectory'.padStart(2).padEnd(30) + baseProjectDirectory);
logger.info('PackagesDirectory'.padStart(2).padEnd(30) + packagesDirectory);
logger.info('OutputDirectory'.padStart(2).padEnd(30) + outputDirectory);
logger.info('ALEXEPath'.padStart(2).padEnd(30) + alcPath);
logger.info('');

// confirm all variables exist:
const requiredInputs = { entireAppName, baseProjectDirectory, packagesDirectory, outputDirectory, alcPath };
for (const [key, value] of Object.entries(requiredInputs)) {
    if (!value) {
        logger.error(`Missing required input: ${key}`);
        process.exit(1);
    }
}

// discover platform and environment
logger.debug(`Platform detected: ${os.platform()}`)
const isWindows = os.platform() === "win32";
logger.debug(`isWindows: ${isWindows}`);
logger.debug(`Working directory: ${process.cwd()}`);

// check for existence and execution permissions on ALC
logger.debug('Checking for existence of ALC at target location');
if (!fs.existsSync(alcPath)) {
    logger.error(`ALC[.EXE] PATH not found at ${alcPath}; terminating...`);
    throw new Error(`ALC missing at path ${alcPath}`);
}

if (!alcPath.toLowerCase().endsWith(isWindows ? 'alc.exe' : 'alc')) {
    alcReference = path.join(alcPath, isWindows ? 'alc.exe' : 'alc');
    logger.debug(`Modified ALC path to include the executable: ${alcReference}`);
} else {
    alcReference = alcPath;
    logger.debug(`Using ALC path that includes the executable: ${alcReference}`);
}

try {
    fs.accessSync(alcPath, fs.constants.X_OK);
} catch {
    logger.warn('ALC was found, but not executable; attempting to apply execution permissions');
    try {
        fs.chmodSync(alcPath, 0o755);
        logger.warn(`Successfully applied execution privilege to ${alcPath}`);
    } catch (err) {
        logger.error(`Failed to set execution permission: ${err.message}`);
        process.exit(1);
    }
}

// check for existence of packagesDirectory
logger.debug(`Checking for existence of packagesDirectory at ${packagesDirectory}`);
if (!fs.existsSync(packagesDirectory)) {
    logger.error(`Didn't find anything at ${packagesDirectory}; terminating...`);
    process.exit(1);
}

// check for existence of output directory for the compiled package
logger.debug(`Checking for existence of outputDirectory at ${outputDirectory}`);
try {
    fs.mkdirSync(outputDirectory, { recursive: true });
    logger.info(`Ensured output directory exists: ${outputDirectory}`);
} catch (err) {
    logger.error(`Failed to create / confirm directory at ${outputDirectory}; failed with ${err.message}`);
    process.exit(1);
}

// build arguments for ALC
outputFile = path.join(outputDirectory, entireAppName);
logger.debug(`Specifying output as ${outputFile}`);
logger.debug(`Building Windows array?: ${isWindows}`);
const args = isWindows 
? [
    `/project:${baseProjectDirectory}`,
    `/out:${outputDirectory}`,
    `/packageCachePath:${packagesDirectory}`
]
: [
    '--project', baseProjectDirectory,
    '--out', outputDirectory,
    '--packagecachepath', packagesDirectory
];

// attempt execution of ALC
logger.info(`Executing ALC with args:\n${[alcPath, ...args].map(x => `"${x}"`).join(' ')}`);

const proc = spawn(alcReference, args, { stdio: 'inherit' });

proc.on('error', (err) => {
    logger.error(`Spawn error: ${err.message}`);
    process.exit(1);
});

proc.on('close', (code) => {
    if (code !== 0) {
        logger.warn(`ALC failed with exit code ${code}`);
        process.exit(code);
    } else {
        logger.info('ALC compilation completed successfully');
    }
});
