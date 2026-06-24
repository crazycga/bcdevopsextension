const path = require('path');
const fs = require('fs');
const { stat } = require('fs');
const { logger, normalizePath } = require('CommonTools.js');

// Sample:
// {
//      "$schema": "https://crazycga.github.io/bcdevopsextension/schema/manifest-1.0.schema.json",
//      "packingSlipVersion": "1.0",
//      "application": packingSlipAtom,
//      "testApplication": packingSlipAtom
// }

function GeneratePackingSlip(application, testApplication) {
    let proposedResponse = {
        $schema: "https://crazycga.github.io/bcdevopsextension/schema/manifest-1.0.schema.json",
        packingSlipVersion: "1.0",
        application: application,
        testApplication: testApplication
    }

    return proposedResponse;
}