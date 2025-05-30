const path = require('path');

let fetch;
try {
    fetch = require('node-fetch');
} catch (err) {
    console.warn("'node-fetch' not found. Attempting to install...");
    const projectRoot = path.resolve(__dirname, '..');

    const { execSync } = require('child_process');
    try {
        execSync('npm install node-fetch@2 --no-progress --log-level=warning', { cwd: projectRoot, stdio: 'inherit' });
        fetch = require('node-fetch');
    } catch (installErr) {
        console.error("Auto-install failed. Aborting.");
        console.error(installErr);
        process.exit(1);
    }
}

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

async function getToken(tenantId, clientId, clientSecret) {
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

async function getCompanies(token, tenantId, environmentName) {
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

async function getModules(token, tenantId, environmentName, companyId, moduleId, excludeMicrosoft) {
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

    console.debug(`API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        console.error('Failed to get modules: ', response.status);
        const error = await response.text();
        console.error(error);
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
            const name = module.name;
            const id = module.id;
            console.debug(`**** ${idx + 1}. ${module.displayName} (ID: ${module.id})`);
        });

    return checkValue.some(m => m.id === moduleId);
}

module.exports = {
    getToken,
    getCompanies,
    getModules,
    confirmModule
}