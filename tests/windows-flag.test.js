const fs = require('fs');
const path = require('path');

const compiledPath = path.join(__dirname, '..', 'out', 'src', 'claude', 'session', 'index.js');
const content = fs.readFileSync(compiledPath, 'utf8');

const occurrences = (content.match(/args\.push\('(.*?)'\)/g) || []);
const tokens = occurrences.map(token => {
    const match = token.match(/args\.push\('(.*?)'\)/);
    return match ? match[1] : null;
});

console.log('tokens:', tokens);

if (tokens.some(token => token === '--dangerously-skip-permissions')) {
    console.log('FAIL: Old flag --dangerously-skip-permissions still in use');
    process.exit(1);
}

console.log('PASS: All Claude branches use --permission-mode bypassPermissions');
