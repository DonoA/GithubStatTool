const { execSync } = require('child_process');
const fs = require('fs');

try {
    fs.symlinkSync('../views', 'dist/views');
} catch(ex) { }

let stdout = execSync('./node_modules/.bin/tsc');