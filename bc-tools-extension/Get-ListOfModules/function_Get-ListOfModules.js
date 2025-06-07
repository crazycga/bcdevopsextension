const path = require('path');
const commonTools = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { logger } = require(path.join(__dirname, '_common', 'CommonTools.js'));

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

        logger.info('Modules:');
        modules.forEach((module, idx) => {
            const name = module.displayName;
            const id = module.id;
            const pid = module.packageId
            const version = `${module.versionMajor}.${module.versionMinor}.${module.versionBuild}.${module.versionRevision}`;
            logger.info(`${(idx + 1).toString().padStart(3)}. ${name.padEnd(60)} (Module ID: ${id}) v${version.padEnd(20)} (Package ID: ${pid})`);
        });
    } catch (error) {
        logger.error(`Error: ${error.message}`);
    }
})();