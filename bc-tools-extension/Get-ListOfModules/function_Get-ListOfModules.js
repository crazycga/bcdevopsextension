const commonTools = require('../_common/CommonTools');

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;
const companyId = process.env.INPUT_COMPANYID;

const moduleId = process.env.INPUT_MODULEID;
const excludeMicrosoft = process.env.INPUT_EXCLUDEMICROSOFT;

(async () => {
    try {
        const token = await commonTools.getToken(tenantId, clientId, clientSecret);
        const modules = await commonTools.getModules(token, tenantId, environmentName, companyId, moduleId, excludeMicrosoft);

        console.log('Modules:');
        modules.forEach((module, idx) => {
            const name = module.name;
            const id = module.id;
            console.log(`${idx + 1}. ${module.displayName} (ID: ${module.id})`);
        });
    } catch (error) {
        console.error('Error: ', error.message);
    }
})();