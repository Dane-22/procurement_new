const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.jsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replace unused catch (err) with catch (_err)
    if (content.includes('catch (err)')) {
        content = content.replace(/catch \(err\)/g, 'catch (_err)');
        changed = true;
    }
    
    // Replace err with _err in arrow functions if it's there
    if (content.includes('(err) =>')) {
        content = content.replace(/\(err\) =>/g, '(_err) =>');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
console.log('Done auto-fixing err variables');
