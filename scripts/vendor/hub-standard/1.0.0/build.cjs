#!/usr/bin/env node
const {build} = require('./portal.cjs');
try { console.log(JSON.stringify(build(process.argv[2] || process.cwd(), process.argv[3]))); }
catch (e) { console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
