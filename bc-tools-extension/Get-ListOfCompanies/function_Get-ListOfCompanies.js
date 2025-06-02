const fs = require('fs');
const path = require('path');

//const commonTools = require('_common/CommonTools');

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;

(async () => {
    console.log('process.cwd():', process.cwd());        // where the process was started
    console.log('__dirname:', __dirname);                // where the current script file resides


    console.log('Enumerating parent:');
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

    console.log('Enumerating current:');
    fs.readdir('.', (err, files) => {
        if (err) {
            console.error('Error reading directory: ', err);
            return;
        }
        console.log('Files in parent directory:');
        files.forEach(file => {
            console.log(file);
        });
    });

    let current = __dirname;
    let depth = 5;
    for (let i = 0; i < depth; i++) {
        console.log(`\n📂 Contents of: ${current}`);
        try {
            const files = fs.readdirSync(current);
            files.forEach(f => console.log('  -', f));
        } catch (e) {
            console.error(`  (Error reading ${current}: ${e.message})`);
        }
        current = path.resolve(current, '..');
    }

    console.log('**********************************************************');
    const expectedPath = path.resolve(__dirname, '../_common/CommonTools.js');
    console.log('👀 Trying to stat:', expectedPath);
    try {
        fs.statSync(expectedPath);
        console.log('✅ Found commonTools at expected path');
    } catch {
        console.log('❌ commonTools NOT found at expected path');
    }

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