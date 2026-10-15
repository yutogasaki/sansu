#!/usr/bin/env node
const {verify} = require('./portal.cjs');
try { console.log(JSON.stringify(verify(process.argv[2] || process.cwd(), process.argv[3]))); }
catch (e) { console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
