const path = require('path');
const commonTools = require(path.join(__dirname, '_common', 'CommonTools.js'));

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;
const companyId = process.env.INPUT_COMPANYID;
const filePath = process.env.INPUT_APPFILEPATH;
const skipPolling = commonTools.parseBool(process.env.INPUT_SKIPPOLLING);
const pollingFrequency = parseInt(process.env.INPUT_POLLINGFREQUENCY);
const maxTimeout = parseInt(process.env.INPUT_MAXPOLLINGTIMEOUT);

(async () => {

    console.log("Calling deployment of module with the following parameters:");
    console.log(`TenantId: ${tenantId}`);
    console.log(`EnvironmentName: ${environmentName}`);
    console.log(`ClientId: ${clientId}`);
    console.log(`ClientSecret: [REDACTED]`);
    console.log(`CompanyId: ${companyId}`);
    console.log(`AppFilePath: ${filePath}`);
    console.log(`SkipPolling: ${skipPolling}`);
    console.log(`PollingFrequency: ${pollingFrequency}`);
    console.log(`MaxPollingTimeout: ${maxTimeout}`);
    console.log('');

    try {
        console.log('>>>>>>>>>> getToken');
        const token = await commonTools.getToken(tenantId, clientId, clientSecret);
        console.log('>>>>>>>>>> createInstallationBookmark');
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
        console.debug('>>>>>>>>>> ExtId (the bookmark): ', extId);
        console.debug('>>>>>>>>>> @odata.etag: ', odata_etag);
        console.debug('');
        console.log('>>>>>>>>>> uploadInstallationFile');
        let resulting = await commonTools.uploadInstallationFile(token, tenantId, environmentName, companyId, extId, filePath, odata_etag);
        console.log('Waiting 5 seconds to allow backend to process file...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('>>>>>>>>>> callNavUploadCommand');
        let callUpload = await commonTools.callNavUploadCommand(token, tenantId, environmentName, companyId, extId, odata_etag);
        console.log('>>>>>>>>>> now awaiting response');
        if (!skipPolling) {
            let responseCallback = await commonTools.waitForResponse(token, tenantId, environmentName, companyId, extId, pollingFrequency, maxTimeout);
        }
        console.log('>>>>>>>>>> done');
    }
    catch (error) {
        console.error('Error: ', error.message);
    }
})();