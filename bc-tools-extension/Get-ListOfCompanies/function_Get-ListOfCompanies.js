const fs = require('fs');

const commonTools = require('_common/CommonTools');

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;

(async () => {
    fs.readdir('..', (err, files) => {
        if (err) {
            console.error('Error reading directory: ', err);
            return;
        }
        console.log('Files in parent directory:');
        files.forEach(file => {
            console.log(file);
        });
    });
    // try {
    //     const token = await commonTools.getToken(tenantId, clientId, clientSecret);
    //     const companies = await commonTools.getCompanies(token, tenantId, environmentName);

    //     console.log('Companies:');
    //     companies.forEach((company, idx) => {
    //         const name = company.name;
    //         const id = company.id;
    //         console.log(`${idx + 1}. ${company.name} (ID: ${company.id})`);
    //     });
    // }
    // catch (error) {
    //     console.error('Error: ', error.message);
    // }
})();