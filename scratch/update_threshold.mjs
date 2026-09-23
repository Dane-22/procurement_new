import fs from 'fs';
import path from 'path';

const files = [
    'c:/wamp64/www/procurement/backend/routes/purchaseRequests.js',
    'c:/wamp64/www/procurement/system-flowchart.md',
    'c:/wamp64/www/procurement/DAILY_FOLDER/DAILY_REPORT.MD'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/10,000/g, '100,000');
        content = content.replace(/10000(?!0)/g, '100000');
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
}
