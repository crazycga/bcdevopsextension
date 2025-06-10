const path = require('path');
const commonTools = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { logger, normalizePath } = require(path.join(__dirname, '_common', 'CommonTools.js'));

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;
const companyId = process.env.INPUT_COMPANYID;
const filePath = normalizePath(process.env.INPUT_APPFILEPATH);
const skipPolling = commonTools.parseBool(process.env.INPUT_SKIPPOLLING);
const pollingFrequency = parseInt(process.env.INPUT_POLLINGFREQUENCY);
const maxTimeout = parseInt(process.env.INPUT_MAXPOLLINGTIMEOUT);

(async () => {

    logger.info("Calling deployment of module with the following parameters:");
    logger.info(`TenantId: ${tenantId}`);
    logger.info(`EnvironmentName: ${environmentName}`);
    logger.info(`ClientId: ${clientId}`);
    logger.info(`ClientSecret: [REDACTED]`);
    logger.info(`CompanyId: ${companyId}`);
    logger.info(`AppFilePath: ${filePath}`);
    logger.info(`SkipPolling: ${skipPolling}`);
    logger.info(`PollingFrequency: ${pollingFrequency}`);
    logger.info(`MaxPollingTimeout: ${maxTimeout}`);
    logger.info('');

    try {
        logger.info('>>>>>>>>>> getToken');
        const token = await commonTools.getToken(tenantId, clientId, clientSecret);
        logger.info('>>>>>>>>>> createInstallationBookmark');
        let test = await commonTools.createInstallationBookmark(token, tenantId, environmentName, companyId);
        let extId;
        let odata_etag;
        if (Array.isArray(test)) {
            extId = test[0].systemId;
            odata_etag = test[0]['@odata.etag'];
        } else { 
            extId = test.systemId;
            odata_etag = test['@odata.etag'];
        }
        logger.debug(`>>>>>>>>>> ExtId (the bookmark): ${extId}`);
        logger.debug(`>>>>>>>>>> @odata.etag: ${odata_etag}`);
        logger.debug('');
        logger.info('>>>>>>>>>> uploadInstallationFile');
        let resulting = await commonTools.uploadInstallationFile(token, tenantId, environmentName, companyId, extId, filePath, odata_etag);
        logger.info('Waiting 5 seconds to allow backend to process file...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        logger.info('>>>>>>>>>> callNavUploadCommand');
        let callUpload = await commonTools.callNavUploadCommand(token, tenantId, environmentName, companyId, extId, odata_etag);
        logger.info('>>>>>>>>>> now awaiting response');
        if (!skipPolling) {
            let responseCallback = await commonTools.waitForResponse(token, tenantId, environmentName, companyId, extId, pollingFrequency, maxTimeout);
        }
        logger.info('>>>>>>>>>> done');
    }
    catch (error) {
        logger.error(`Error: ${error.message}`);
    }
})();