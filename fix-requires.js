/**
 * fix-requires.js
 *
 * For projects where every file sits in ONE folder but the code still
 * requires paths like '../controllers/authcontroller' or '../middleware/auth'.
 * It rewrites each broken relative require to the real file, e.g.
 *   require('../controllers/authcontroller')  ->  require('./auth.controller')
 *
 * Usage (run inside the folder that has server.js):
 *   node fix-requires.js            # dry run: only shows what WOULD change
 *   node fix-requires.js --write    # applies the changes
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'public', 'uploads']);
const REQUIRE_RE = /require\(\s*(['"])(\.{1,2}\/[^'"]*)\1\s*\)/g;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const norm = (s) => s.toLowerCase().replace(/\.js$/, '').replace(/[^a-z0-9]/g, '');
const singular = (s) => (s.length > 3 && s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s);

const files = walk(ROOT);
const index = new Map(); // normalized name -> [absolute paths]
for (const f of files) {
  const key = norm(path.basename(f));
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(f);
}

// Exact, case-correct resolution of a relative require (file, .json, or folder/index.js).
function resolvesExactly(fromFile, req) {
  const abs = path.resolve(path.dirname(fromFile), req);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith('..')) return false; // points outside the project
  const parts = rel.split(path.sep).filter(Boolean);
  let cur = ROOT;
  for (let i = 0; i < parts.length; i++) {
    let names;
    try { names = fs.readdirSync(cur); } catch { return false; }
    const last = i === parts.length - 1;
    const wanted = last ? [parts[i], parts[i] + '.js', parts[i] + '.json'] : [parts[i]];
    const hit = wanted.find((w) => names.includes(w));
    if (!hit) return false;
    cur = path.join(cur, hit);
  }
  return true;
}

function findReplacement(fromFile, req) {
  const segs = req.split('/').filter((s) => s && s !== '.' && s !== '..');
  const base = norm(segs[segs.length - 1] || '');
  const dir = segs.length > 1 ? norm(singular(segs[segs.length - 2])) : '';

  // Try "authcontroller" (name + folder hint) first, then plain "auth".
  const keys = [];
  if (dir) keys.push(base + dir);
  keys.push(base);

  for (const key of keys) {
    const hits = (index.get(key) || []).filter((p) => p !== fromFile);
    if (hits.length === 1) return { target: hits[0] };
    if (hits.length > 1) return { ambiguous: hits };
  }
  return null;
}

let fixed = 0;
let unresolved = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  const updated = original.replace(REQUIRE_RE, (full, quote, req) => {
    if (resolvesExactly(file, req)) return full;

    const found = findReplacement(file, req);
    if (found && found.target) {
      let next = path.relative(path.dirname(file), found.target).split(path.sep).join('/');
      next = next.replace(/\.js$/, '');
      if (!next.startsWith('.')) next = './' + next;
      console.log(`FIX   ${rel}\n      ${req}  ->  ${next}`);
      fixed++;
      return `require(${quote}${next}${quote})`;
    }

    unresolved++;
    if (found && found.ambiguous) {
      console.log(`AMBIGUOUS  ${rel}\n      ${req} could be: ${found.ambiguous.map((p) => path.relative(ROOT, p)).join(', ')}`);
    } else {
      console.log(`MISSING    ${rel}\n      ${req} — no matching file in the project`);
    }
    return full;
  });

  if (WRITE && updated !== original) fs.writeFileSync(file, updated);
}

console.log(
  `\n${fixed} require(s) ${WRITE ? 'fixed' : 'would be fixed'}, ${unresolved} need manual attention.` +
    (WRITE ? '' : '\nRun again with --write to apply.')
);
