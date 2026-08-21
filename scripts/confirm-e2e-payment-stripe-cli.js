#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var statePath = path.join(__dirname, '..', '.e2e-run-state.json');

if (!fs.existsSync(statePath)) {
    console.error('Missing .e2e-run-state.json — run production-e2e-setup.js first');
    process.exit(1);
}

var state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
var piId = state.piId;

console.log('[stripe-cli] Confirming', piId);

var out = execSync(
    'stripe payment_intents confirm ' + piId +
    ' --payment-method pm_card_visa' +
    ' --return-url "https://onda-prodigio.vercel.app/comunidade/?welcome=1"',
    { encoding: 'utf8' }
);

var result = JSON.parse(out);

if (result.status !== 'succeeded') {
    console.error('Payment not succeeded:', result.status || result.error);
    process.exit(1);
}

console.log('[stripe-cli] Payment succeeded');
