import fs from 'fs';
import path from 'path';

const jsDir = 'public/frontend/js';
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
let hasError = false;

for (const file of files) {
  const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"](\.\/[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const symbols = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const targetMod = match[2];
    const targetFile = path.join(jsDir, targetMod.endsWith('.js') ? targetMod : targetMod + '.js');
    if (!fs.existsSync(targetFile)) {
      console.error(`File not found: ${targetFile} imported in ${file}`);
      hasError = true;
      continue;
    }
    const targetContent = fs.readFileSync(targetFile, 'utf8');
    for (const sym of symbols) {
      const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exportRegex = new RegExp(`(export\\s+(async\\s+)?(function|const|let|var|class)\\s+${escapedSym}([^a-zA-Z0-9_$]|$)|export\\s*\\{[^}]*([^a-zA-Z0-9_$]|^)${escapedSym}([^a-zA-Z0-9_$]|$)[^}]*\\})`);
      if (!exportRegex.test(targetContent)) {
        console.error(`MISSING EXPORT: "${sym}" not exported by ${targetMod} (imported in ${file})`);
        hasError = true;
      }
    }
  }
}
if (!hasError) console.log('✓ ALL IMPORTS VALIDATED ACROSS ALL FRONTEND SCRIPTS!');
