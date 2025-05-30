let fetch;
try {
    fetch = require('node-fetch');
} catch (err) {
    console.warn("'node-fetch' not found. Attempting to install...");
    const { execSync } = require('child_process');
    try {
        execSync('npm install node-fetch@2 --silent --no-progress --no-audit --loglevel=error', { stdio: 'inherit' });
        fetch = require('node-fetch');
    } catch (installErr) {
        console.error("Auto-install failed. Aborting.");
        process.exit(1);
    }
}

const tenantId = process.env.INPUT_TENANTID;
const clientId = process.env.INPUT_CLIENTID;
const clientSecret = process.env.INPUT_CLIENTSECRET;
const environmentName = process.env.INPUT_ENVIRONMENTNAME;

async function getToken() {
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
        console.error('Failed to acquire token: ', response.status);
        const error = await response.text();
        console.error(error);
        throw new Error('Authentication failed');
    }

    const data = await response.json();
    return data.access_token;
}

async function getCompanies(token) {
    const apiUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environmentName}/api/v2.0/companies`;

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        console.error('Failed to get companies: ', response.status);
        const error = await response.text();
        console.error(error);
        throw new Error('Company list query failed');
    }

    const data = await response.json();
    return data.value;
}

(async () => {
    try {
        const token = await getToken();
        const companies = await getCompanies(token);

        console.log('Companies:');
        companies.forEach((company, idx) => {
            const name = company.name;
            const id = company.id;
            console.log(`${idx + 1}. ${company.name} (ID: ${company.id})`);
        });
    }
    catch (error) {
        console.error('Error: ', error.message);
    }
})();