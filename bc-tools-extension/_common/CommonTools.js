const path = require('path');
const fs = require('fs/promises');
const { stat } = require('fs');

const testMode = process.env.INPUT_TESTMODE;

function escapeForVso(message) {
    if (typeof message !== 'string') return '';

    return message
        .replace(/%/g, '%25')      // MUST come first to avoid double escaping
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
}

const logger = {
    debug: async function (message) {
        console.log(`##vso[task.debug]${escapeForVso(message)}`);
    },
    info: async function (message) {
        console.log(message);
    },
    warn: async function (message) {
        console.log(`##vso[task.logissue type=warning]${escapeForVso(message)}`);
    },
    error: async function (message) {
        console.log(`##vso[task.logissue type=error]${escapeForVso(message)}`);
    }
};

// using an environmental variable of TESTMODE = "true" will try and prevent specific JSON posts; it is a left over from initial testing
if (parseBool(testMode)) {
    logger.info(`Invocation received with TestMode: ${testMode}`);
}

// sanitize file paths and names, etc.
function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

// this module uses undici for fetching specifically because the call to Microsoft.NAV.upload will return malformed and node-fetch can't parse it
let fetch = null;

function usesUndici() {
    if (!fetch) {
        try {
            fetch = require('undici').fetch;
        } catch (_) {
            logger.warn("'undici' not found. Attempting to install...");
            const projectRoot = path.resolve(__dirname, '..');

            const { execSync } = require('child_process');
            try {
                execSync('npm install undici --no-progress --loglevel=warn', {
                    cwd: projectRoot,
                    stdio: 'inherit'
                });
                fetch = require('undici').fetch;
            } catch (installErr) {
                console.error("Auto-install of 'undici' failed. Aborting.");
                console.error(installErr);
                process.exit(1);
            }
        }
    }
    return fetch;
}



/**
 * An obfuscation routine to block the client_secret in token request bodies
 * @param {string} body - the body of the token request, as a string
 * @returns {string} A string that obfuscates client_secret
 */
function maskSecretInObject(body) {
    const clone = { ...body };
    if (clone.client_secret) {
        clone.client_secret = '****';
    }
    return clone;
}

/**
 * An obfuscation routine to block the client_secret in token request bodies
 * @param {URLSearchParams} params - the parameters used in a token request
 * @returns {URLSearchParams} an object that obfuscates client_secret
 */
function maskSecretInParams(params) {
    const clone = new URLSearchParams(params);
    if (clone.has('client_secret')) {
        clone.set('client_secret', '<Are you nuts?>');
    }
    return clone;
}

/**
 * A standardized string parser to use in a boolean condition
 * @param {string} val - a value that is being enumerated for a boolean condition
 * @returns {boolean} true if (val) is a variant of 'true', '1', 'yes', or 'on'; false if not, or missing
 */
function parseBool(val) {
    const trueVals = ['true', '1', 'yes', 'on'];
    const falseVals = ['false', '0', 'no', 'off'];

    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (trueVals.includes(normalized)) return true;
        if (falseVals.includes(normalized)) return false;
    }
    return false;           // because the lack of the variable implies it wasn't set; think Powerhsell switch
}

/**
 * Gets a bearer token from the Microsoft login
 * @param {string} tenantId - a guid of the tenant id for the login
 * @param {string} clientId - a guid of the client id for the login
 * @param {string} clientSecret - a string for the client secret of the login
 * @returns {string} a bearer token, if successful
 */
async function getToken(tenantId, clientId, clientSecret) {
    usesUndici();
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://api.businesscentral.dynamics.com/.default');

    const body = params.toString();

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    if (!response.ok) {
        logger.error(`Failed to acquire token: ${response.status}`);
        const error = await response.text();
        logger.error(error);
        throw new Error('Authentication failed');
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Gets a list of the companies in Business Central
 * @param {string} token - the bearer token that has been acquired 
 * @param {string} tenantId - a guid of the tenant id for the Business Central tenant
 * @param {string} environmentName - a string of the environment name from the administration center in Business Central
 * @returns {object} a Business Central object, list of companies
 */
async function getCompanies(token, tenantId, environmentName) {
    usesUndici();
    const apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/v2.0/companies`;

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        logger.error(`Failed to get companies: ${response.status}`);
        const error = await response.text();
        logger.error(error);
        throw new Error('Company list query failed');
    }

    const data = await response.json();
    return data.value;
}

/**
 * Gets a list of the installed modules in the Business Central tenant
 * @param {string} token - bearer token that has been acquired
 * @param {string} tenantId - a guid of the tenant id for the Business Central tenant
 * @param {string} environmentName - a string of the environment name from the administration center in Business Central
 * @param {string} companyId - a guid of the company id being enumerated (use getCompanies() for a list)
 * @param {string} moduleId - optional - restrict to just this one reference of a module for the list
 * @param {boolean} excludeMicrosoft - optional - restrict the list to just non-Microsoft modules only
 * @returns {object} a Business Central object, list of modules installed
 */
async function getModules(token, tenantId, environmentName, companyId, moduleId, excludeMicrosoft) {
    usesUndici();
    let apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensions`;

    const filters = [];

    if (moduleId && moduleId.trim() !== "") {
        filters.push(`id eq ${moduleId}`);
    }

    if (parseBool(excludeMicrosoft)) {
        filters.push(`publisher ne 'Microsoft'`);
    }

    if (filters.length > 0) {
        apiUrl += `?$filter=${filters.join(" and ")}`;
    }

    logger.debug(`API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        logger.error(`Failed to get modules: ${response.status}`);
        const error = await response.text();
        logger.error(error);
        throw new Error('Module list query failed');
    }

    const data = await response.json();
    return data.value;
}

async function confirmModule(token, tenantId, environmentName, companyId, moduleId) {

    if (typeof moduleId !== 'string' || moduleId.trim() === "") {
        throw new Error(`Module id is blank or missing.  Module id was: ${moduleId}`);
    }

    let checkValue = await getModules(token, tenantId, environmentName, companyId, moduleId);

    checkValue.forEach((module, idx) => {
            logger.debug(`**** ${idx + 1}. ${module.displayName} (ID: ${module.id})`);
        });

    return checkValue.some(m => m.id === moduleId);
}

// steps for uploading and publishing an extension.
// 1. create an extension upload bookmark
// 2. upload the .app file to the id of the bookmark
// 3. POST to Microsoft.NAV.upload
// 4. wait a thousand years for completion
// 5. Profit!

/**
 * Gets the installation status from the Business Central installation subsystem
 * @param {string} token
 * @param {string} tenantId - GUID format
 * @param {string} environmentName 
 * @param {string} companyId - GUID format
 * @param {string} [operationId] - Guid format - optional
 * @returns {object?} if successful, a response object; status is at .status
 */
async function getInstallationStatus(token, tenantId, environmentName, companyId, operationId) {
    usesUndici();
    let apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensionDeploymentStatus`;
    logger.debug(`API (getInstallationStatus) ${apiUrl}`);

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        logger.error(`Failed to get extension deployments: ${response.status}`);
        const error = await response.text();
        logger.error(error);
        throw new Error('Extension deployment status query failed');
    }

    //console.debug('API response (getInstallationStatus)');
    const data = await response.json();
    
    //console.debug(data);
    return data.value;    
}

/**
 * Creates the placeholder for the installation update; will return the existing record if a duplicate exists
 * @param {string} token
 * @param {string} tenantId - GUID format
 * @param {string} environmentName 
 * @param {string} companyId - GUID format
 * @param {string} [schedule] - optional - one of "Current version", "Next major version", "Next minor version"; default: "Current version"
 * @param {string} [syncMode] - optional - one of "Add" or "Force"; default: "Add"
 * @returns {object?} if successful, a response object; the salient point is ".systemId" (a guid)
 */
async function createInstallationBookmark(token, tenantId, environmentName, companyId, schedule, syncMode) {
    //
    // ** internal note: when this routine gets record back from POST, it is a singleton, like this:
    // {
    //     "@odata.context": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/$metadata#companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload/$entity",
    //     "@odata.etag": "W/\"JzE5OzEwNjIwNjAxNDc4ODMyMzQ1MzAxOzAwOyc=\"",
    //     "systemId": "fed6d3c7-a03d-f011-be59-000d3aefada9",
    //     "schedule": "Current_x0020_version",
    //     "schemaSyncMode": "Add",
    //     "extensionContent@odata.mediaEditLink": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload(fed6d3c7-a03d-f011-be59-000d3aefada9)/extensionContent",
    //     "extensionContent@odata.mediaReadLink": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload(fed6d3c7-a03d-f011-be59-000d3aefada9)/extensionContent"
    // }
    //
    // HOWEVER, when executing a GET command, it comes back as an array, like this:
    // {
    //     "@odata.context": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/$metadata#companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload",
    //     "value": [
    //         {
    //             "@odata.etag": "W/\"JzE5OzEwNjIwNjAxNDc4ODMyMzQ1MzAxOzAwOyc=\"",
    //             "systemId": "fed6d3c7-a03d-f011-be59-000d3aefada9",
    //             "schedule": "Current_x0020_version",
    //             "schemaSyncMode": "Add",
    //             "extensionContent@odata.mediaEditLink": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload(fed6d3c7-a03d-f011-be59-000d3aefada9)/extensionContent",
    //             "extensionContent@odata.mediaReadLink": "https://api.businesscentral.dynamics.com/v2.0/1e8ccacd-46cd-46d6-909a-8b8c3da8220b/ussandbox/api/microsoft/automation/v2.0/companies(fb615954-ba2b-f011-9af4-6045bdc89d67)/extensionUpload(fed6d3c7-a03d-f011-be59-000d3aefada9)/extensionContent"
    //         }
    //     ]
    // }
    //
    // This means, when returning the POST, the return is object.systemId, when returning the GET, the return is object[0].systemId

    usesUndici();
    let apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensionUpload`;
    logger.debug(`API (createInstallationBookmark) ${apiUrl}`);

    // per: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/resources/dynamics_extensionupload
    if (!schedule || schedule.trim() === "") {
        schedule = 'Current version';
    }

    if (!['Current version', 'Next minor version', 'Next major version'].includes(schedule) && schedule?.trim() !== "") {
        throw new Error ('\'schedule\' must be one of: \'Current version\', \'Next minor version\', or \'Next major version\', or left blank');
    }

    // per: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/resources/dynamics_extensionupload
    if (!syncMode || syncMode.trim() === "") {
        syncMode = "Add";
    }

    if (!['Add', 'Force Sync'].includes(syncMode) && syncMode?.trim() !== "") {
        throw new Error ('\'syncMode\' must be one of: \'Add\', or \'Force Sync\', or left blank');
    }

    const body = {
        schedule: schedule,
        schemaSyncMode: syncMode
    };
    
    const _debugBody = await JSON.stringify(body);
    logger.debug('Request body:');
    logger.debug(_debugBody);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const status = response.status;

        let errorResponse;
        try {
            errorResponse = await response.json();
        } catch (e) {
            const raw = await response.text();
            logger.error(`Non-JSON error response: ${raw}`);
            throw new Error('Extension slot creation failed with unknown format');
        }

        logger.error(`BC API error response: ${JSON.stringify(errorResponse, null, 2)}`);

        if (status === 400 && errorResponse?.error?.code === "Internal_EntityWithSameKeyExists") {
            logger.warn('Extension upload already exists - retrieving existing record...');
            const secondResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (secondResponse.ok) {
                logger.info('Found existing record; parsing and returning to routine');
                const secondValue = await secondResponse.json();
                if (Array.isArray(secondValue)) {
                    return secondValue.value[0];    // see internal note above
                } else {
                    return secondValue.value;
                }
            }
        }

        throw new Error('Extension slot creation query failed');
    }

    const data = await response.json();
    logger.debug('(createInstallationBookmark) returning: ');
    logger.debug(data);
    return data;    
}

/**
 * 
 * @param {string} token 
 * @param {string} tenantId 
 * @param {string} environmentName 
 * @param {string} companyId 
 * @param {string} operationId 
 * @param {string} filePathAndName 
 * @returns {boolean} true if successful; false if not
 */
async function uploadInstallationFile(token, tenantId, environmentName, companyId, operationId, filePathAndName, odata_etag) {
    usesUndici();
    const apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensionUpload(${operationId})/extensionContent`;
    logger.debug(`API (uploadInstallationFile): ${apiUrl}`);
    logger.debug(`@odata.etag: ${odata_etag}`);

    try {
        await fs.access(filePathAndName);

        const stats = await fs.stat(filePathAndName);
        logger.info(`File found: ${filePathAndName} (${stats.size} bytes)`);

        const fileBuffer = await fs.readFile(filePathAndName);
        logger.info(`Prepared file buffer of ${stats.size} bytes from file`);

        logger.debug(`Uploading file to: ${apiUrl}`);
        logger.debug(`Headers: ${JSON.stringify({
            'Authorization': '[REDACTED]',
            'Content-Type': 'application/octet-stream',
            'If-Match': odata_etag
        }, null, 2)}`);

        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'If-Match': odata_etag
            },
            body: fileBuffer
        });

        if (!response.ok) {
            const error = await response.text();
            const errorCode = response.status;
            logger.error(`Upload failed: status code: ${errorCode}`);
            logger.error(`Upload failed [${response.status}]: ${error}`);
            throw new Error('File upload failed.');
        }

        logger.info(`Upload successful of: ${filePathAndName} with a status code of: ${response.status}`);

        if (response.status === 204) {
            return true;
        } else {
            return false;
        }
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            logger.warn(`File not found: ${filePathAndName}`);
        } else {
            logger.error(`Unexpected error during upload: ${err}`);
        }
        throw err;
    }
}

async function callNavUploadCommand(token, tenantId, environmentName, companyId, operationId, odata_etag) {
    usesUndici();
    const apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensionUpload(${operationId})/Microsoft.NAV.upload`;
    logger.debug(`API (callNavUploadCommand): ${apiUrl}`);
    logger.debug(`@odata.etag: ${odata_etag}`)

    try {
        logger.info('Preparing to call Microsoft.NAV.upload');
        let response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,  
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });

        logger.info('Call to Microsoft.NAV.upload successful?  ¯\\_(ツ)_/¯  It\'s not like Microsoft tells us...');
        if (!response.ok) {
            logger.error(`Failed to call Microsoft.NAV.upload for deployment: ${response.status}`);
            if (response.status === 409) {
                logger.info('Wait a second, that was a 409; this means that the @odata.etag is stale, let me try to get another one');
                let refreshCheck = await createInstallationBookmark(token, tenantId, environmentName, companyId);
                logger.info(`Original odata.etag: ${odata_etag}`);
                if (Array.isArray(refreshCheck)) {
                    odata_etag = refreshCheck[0]['@odata.etag'];
                } else { 
                    odata_etag = refreshCheck['@odata.etag'];
                }
                logger.info(`Refreshed odata.etag: ${odata_etag}`);
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,  
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br'
                    }
                });
            } else {
                const error = await response.text();
                logger.error(error);
                throw new Error('Extension upload call query failed');
            }
        }
        logger.debug(`Made call to Microsoft.NAV.upload; response code: ${response.status}`);
    } catch (err) {
        logger.error(`Error during call: ${err.name} -- ${err.message}`);
        throw err;
    }
}

async function waitForResponse(token, tenantId, environmentName, companyId, operationId, waitTime, maxWaitTime) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms * 1000));
    const startTimeStamp = Date.now();
    let currentTimeStamp = Date.now();

    logger.info(`Waiting an initial 2 seconds before polling...`);
    await sleep(2);

    let manualBreak = false;
    do {
        let thisCheck = await getInstallationStatus(token, tenantId, environmentName, companyId, operationId);
        if (Array.isArray(thisCheck)) {
            if (thisCheck.length === 0) {
                logger.info('Received blank array back on extension installation status check; breaking');
                logger.info('(This usually means that the upload call failed, and/or there are no other upload records in this instance of Business Central.)');
                manualBreak = true;
            }
            else {
                if (thisCheck[0].status !== 'InProgress') {
                    logger.info(`Received status '${thisCheck[0].status}' response; breaking`);
                    manualBreak = true;
                } else {
                    logger.info(`Received status '${thisCheck[0].status}'; continuing to wait another ${waitTime} seconds`);
                }
            }
        }
        logger.debug(`${Date.now()}: checked progress, result: ${thisCheck[0].status}`);
        if (!parseBool(manualBreak)) { await sleep(waitTime) };
        currentTimeStamp = Date.now();
    } while ((((currentTimeStamp - startTimeStamp) / 1000) < maxWaitTime) && !parseBool(manualBreak));
}

// THIS IS A LEFTOVER FROM TESTING; UNCOMMENT TO USE
// async function postTokenJson(url, { headers = {}, body = {} } = {}) {
//     if (parseBool(testMode)) {
//         console.log(`[Mock POST]: ${url}`);
//         console.log('[Mock Headers]: ', headers);
//         console.log('[Mock Body]: ', maskSecretInParams(body));
//         return {
//             ok: true,
//             json: async () => ({ systemId: "00000000-0000-0000-0000-000000000000", schedule: "Current_x0020_version", schemaSyncMode: "Add" })
//         };
//     } else {
//         return await fetch(url, {
//             method: 'POST',
//             headers: headers,
//             body: body
//         });
//     }
// }

module.exports = {
    getToken,
    getCompanies,
    getModules,
    confirmModule,
    getInstallationStatus,
    createInstallationBookmark,
    uploadInstallationFile,
    callNavUploadCommand,
    waitForResponse,
    parseBool,
    logger,
    usesUndici,
    normalizePath
}