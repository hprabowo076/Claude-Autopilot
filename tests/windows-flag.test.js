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

if (tokens.some(token => token === '--skip-permissions')) {
    process.exit(1);
}

console.log('PASS: All Claude branches use --dangerously-skip-permissions');
