const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PassThrough } = require('stream');
const { logger } = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { usesUndici } = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { fetch } = usesUndici();

async( () => {
    // collect variables from input
    const tenantId = process.env.INPUT_TENANTID;
    const environmentName = process.env.INPUT_ENVIRONMENTNAME || 'sandbox';
    const clientId = process.env.INPUT_CLIENTID;
    const clientSecret = process.env.INPUT_CLIENTSECRET;
    const pathToAppJson = process.env.INPUT_PATHTOAPPJSON;
    const pathToPackagesDirectory = process.env.INPUT_PATHTOPACKAGESDIRECTORY;
    const testLoginOnly = process.env.INPUT_TESTLOGINONLY;
    const skipDefaultDependencies = process.env.INPUT_SKIPDEFAULTDEPENDENCIES;

    logger.info('Calling Get-BCDependencies with the following parameters:');
    logger.info('TenantId'.padStart(2).padEnd(30) + tenantId);
    logger.info('EnvironmentName'.padStart(2).padEnd(30) + environmentName);
    logger.info('ClientId'.padStart(2).padEnd(30) + clientId);
    logger.info('ClientSecret'.padStart(2).padEnd(30) + (clientSecret ? '[REDACTED]' : '[NOT PROVIDED]'));
    logger.info('PathToAppJson'.padStart(2).padEnd(30) + pathToAppJson);
    logger.info('PathToPackagesDirectory'.padStart(2).padEnd(30) + pathToPackagesDirectory);
    logger.info('TestLoginOnly'.padStart(2).padEnd(30) + testLoginOnly);
    logger.info('SkipDefaultDependencies'.padStart(2).padEnd(30) + skipDefaultDependencies);

    // confirm all variables exist:
    const requiredInputs = { tenantId, environmentName, clientId, clientSecret, pathToAppJson, pathToPackagesDirectory, testLoginOnly, skipDefaultDependencies };
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

    // authenticate and break if "TestLoginOnly"
    logger.info('>>>>>>>>>> getToken');
    const token = await commonTools.getToken(tenantId, clientId, clientSecret);

    if (commonTools.parseBool(testLoginOnly)) {
        logger.info('Authenticated correctly; routine invoked with TestLoginOnly; terminating gracefully');
        process.exit(0);
    } else {
        logger.debug('Acquired token; moving on');
    }

    // confirm app.json exists
    try {
        let stat = fs.statSync(pathToAppJson)
        if (stat.isDirectory()) {
            pathToAppJson = path.join(pathToAppJson, 'app.json');
            logger.info(`Parsing path ${pathToAppJson}`);
        }
        stat = fs.statSync(pathToAppJson)
        logger.info(`app.json found at ${pathToAppJson}`);
    } catch (err) {
        logger.error(`Invalid reference to app.json at ${pathToAppJson}`);
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // load app.json
    let appJson;
    try {
        const appData = fs.readFileSync(pathToAppJson, 'utf8');
        appJson = JSON.parse(appData);
        logger.info(`Loaded app.json from ${pathToAppJson}`);
        logger.info('');
        logger.info('app.json enumeration:')
        logger.info('App id:'.padStart(2).padEnd(15) + appJson.id);
        logger.info('Publisher:'.padStart(2).padEnd(15) + appJson.publisher);
        logger.info('Version:'.padStart(2).padEnd(15) + appJson.version);
        logger.info('');
    } catch (err) {
        logger.error(`Failed to load or parse app.json at ${pathToAppJson}`);
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // conditionally inject default dependencies
    if (commonTools.parseBool(skipDefaultDependencies) === false) {
        logger.debug('Adding dependencies; building list');
        const baseDependencies = [
            {
                id: '63ca2fa4-4f03-4f2b-a480-172fef340d3f',
                name: 'System Application',
                publisher: 'Microsoft',
                version: ''
            },
            {
                id: 'f3552374-a1f2-4356-848e-196002525837',
                name: 'Business Foundation',
                publisher: 'Microsoft',
                version: ''
            },
            {
                id: '437dbf0e-84ff-417a-965d-ed2bb9650972',
                name: 'Base Application',
                publisher: 'Microsoft',
                version: ''
            },
            {
                id: '6f2c034f-5ebe-4eae-b34c-90a0d4e87687',
                name: '_Exclude_Business_Events_',
                publisher: 'Microsoft',
                version: ''
            }, 
            {
                id: '8874ed3a-0643-4247-9ced-7a7002f7135d',
                name: 'System',
                publisher: 'Microsoft',
                version:''
            },
            {
                id: '00000000-0000-0000-0000-000000000000',
                name: 'Application',
                publisher: 'Microsoft',
                version: ''
            }
        ];

        if (!Array.isArray(appJson.dependencies)) {
            appJson.dependencies = [];
        }

        for (const dep of baseDependencies) {
            const exists = appJson.dependencies.some(d => d.id === dep.id || (d.name === dep.name && d.publisher === dep.publisher));
            if (!exists) {
                logger.info(`Adding dependency ${dep.id} (${dep.name}) to list of dependencies`);
                appJson.dependencies.push(dep);
            } else {
                logger.info(`Skipping addition of dependency ${dep.id} (${dep.name}) because it already exists`);
            }
        }
    } else {
        logger.info(`Skipping dependency additions because SkipDefaultDependencies is ${skipDefaultDependencies}`);
    }

    // ensure packages directory exists or is created
    try {
        fs.mkdirSync(pathToPackagesDirectory, { recursive: true });
        logger.debug(`Confirmed or created the packages directory at ${pathToPackagesDirectory}`);
    } catch (err) {
        logger.error(`An error occurred trying to confirm or create ${pathToPackagesDirectory}`);
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }

    // start to get the actual dependencies
    for (const dep of appJson.dependencies) {
        const siteId = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/dev/packages?publisher=${dep.publisher}&appName=${dep.name}&versionText=${dep.version}&appId=${dep.id}`;
        logger.debug(`Endpoint: ${siteId}`);
        try {
            logger.info(`Downloading package ${dep.id} (${dep.name})`);
            const response = await fetch(siteId, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/octet-stream'
                }
            });

            if (!response.ok) {
                logger.error(`An error occurred while trying to download ${dep.id} (${dep.name})`);
                const text = await response.text();
                logger.debug(text);
                throw new Error(`Download failed for ${dep.id} (${dep.name})`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            let filename = path.join(pathToPackagesDirectory, `${dep.name}.app`);
            fs.writeFileSync(filename, buffer);
            logger.debug(`File saved: ${filename}`);
        } catch (err) {
            logger.error(`An error occurred downloading ${dep.id} (${dep.name})`);
            logger.error(`Error: ${err.message}`);
            process.exit(1);
        }
    }

    console.info('Downloads complete');

    if (!isWindows) {
        logger.info(`Changing mod on ${pathToPackagesDirectory}`);
        const stats = fs.statSync(pathToPackagesDirectory);
        if (stats.isDirectory()) {
            fs.chmodSync(pathToPackagesDirectory, 0o755);
            for (const file of fs.readdirSync(pathToPackagesDirectory)) {
                fs.chmodSync(path.join(pathToPackagesDirectory, file), 0o755);
                logger.debug(`chmodded ${file}`);
            }
        }
    }

    // enumerate folder for log
    logger.info(`Files now in ${pathToPackagesDirectory}`);
    for (const file of fs.readdirSync(pathToPackagesDirectory)) {
        logger.info(file);
    }
})();