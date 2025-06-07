const fs = require('fs');
const path = require('path');

const commonTools = require(path.join(__dirname, '_common', 'CommonTools.js'));
const { logger } = require(path.join(__dirname, '_common', 'CommonTools.js'));

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;
const extremeDebugMode = commonTools.parseBool(process.env.INPUT_EXTREMEDEBUGMODE);

(async () => {
    // extreme debug mode is specifically used to enumerate the environment in which the VSIX is installed; it is undocumented for a reason
    // and should only be used as a demonstration of how the system actually extracts the VSIX files into the agents.  It was using this 
    // tool that I discovered that _each task_ required a _copy_ of the "_common" directory

    if (extremeDebugMode) {
        console.log('Testing logger function:');
        logger.debug('This is a logger.debug command'.padStart(10));
        logger.info('This is a logger.info command'.padStart(10));
        logger.warn('This is a logger.warn command'.padStart(10));
        logger.error('This is a logger.error command'.padStart(10));
        logger.info('');
        logger.info('');
        logger.debug(`process.cwd(): ${process.cwd()}`);        // where the process was started
        logger.debug(`__dirname: ${__dirname}`);                // where the current script file resides

        logger.debug('Enumerating parent:');
        fs.readdir('..', (err, files) => {
            if (err) {
                logger.error(`Error reading directory: ${err}`);
                return;
            }
            logger.debug('Files in parent directory:');
            files.forEach(file => {
                logger.debug(file);
            });
        });

        logger.debug('Enumerating current:');
        fs.readdir('.', (err, files) => {
            if (err) {
                logger.error(`Error reading directory: ${err}`);
                return;
            }
            logger.debug('Files in parent directory:');
            files.forEach(file => {
                logger.debug(file);
            });
        });

        let current = __dirname;
        let depth = 5;
        for (let i = 0; i < depth; i++) {
            logger.debug(`\nContents of: ${current}`);
            try {
                const files = fs.readdirSync(current);
                files.forEach(f => console.log('  -', f));
            } catch (e) {
                logger.error(`  (Error reading ${current}: ${e.message})`);
            }
            current = path.resolve(current, '..');
        }

        logger.debug('**********************************************************');
        const expectedPath = path.resolve(__dirname, '../_common/CommonTools.js');
        logger.debug(`Trying to stat: ${expectedPath}`);
        try {
            fs.statSync(expectedPath);
            logger.debug('Found commonTools at expected path');
        } catch {
            logger.debug('commonTools NOT found at expected path');
        }
    }

    
    //This is the actual "getCompanies" code
    try {
        const token = await commonTools.getToken(tenantId, clientId, clientSecret);
        const companies = await commonTools.getCompanies(token, tenantId, environmentName);

        logger.info('Companies:');
        companies.forEach((company, idx) => {
            logger.info(`${(idx + 1).toString().padStart(3)}. (ID: ${company.id}) ${company.name.padEnd(80)}`);
        });
    }
    catch (error) {
        logger.error(`Error: ${error.message}`);
    }
})();