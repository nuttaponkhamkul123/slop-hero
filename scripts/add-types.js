// Phase E codemod: reads `tsc --noImplicitAny` output and annotates what it flags.
//   TS7006 (untyped parameter)      -> `: Player` / `: Mob` / `: Item` / `: DungeonInstance` by parameter name, else `: any`
//   TS7053 (index on a typed object) -> `(expr as any)[key]`
//   TS7034 (variable of implicit any) -> `: any`
//   TS7018 (null/undefined property)  -> `value as any`
// Run it again until tsc reports nothing it can fix. Usage: TS_PATH=<typescript 5.x> node scripts/add-types.js <tsc-output.txt> [--dry]
const fs = require('fs');
const path = require('path');
const ts = require(process.env.TS_PATH || 'typescript');

const root = path.join(__dirname, '..');
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const dry = process.argv.includes('--dry');

const PLAYER = new Set(['player', 'killerPlayer', 'targetPlayer', 'caster', 'hero', 'attacker']);
const MOB = new Set(['mob', 'targetMob', 'primary', 'nearby']);
const typeFor = (name) => (PLAYER.has(name) ? 'Player' : MOB.has(name) ? 'Mob' : name === 'item' ? 'Item' : name === 'inst' ? 'DungeonInstance' : 'any');

const byFile = new Map();
for (const l of lines) {
  const m = l.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  if (!m) continue;
  const [, file, line, col, code, msg] = m;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line: +line, col: +col, code, msg });
}

let total = 0; const typeUse = new Map();
for (const [file, errs] of byFile) {
  const abs = path.join(root, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const src = raw.replace(/\r\n/g, '\n');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const edits = [];
  const posOf = (line, col) => sf.getPositionOfLineAndCharacter(line - 1, col - 1);
  const needed = new Set();
  for (const e of errs) {
    const pos = posOf(e.line, e.col);
    if (e.code === 'TS7006') {
      const name = (e.msg.match(/Parameter '(\w+)'/) || [])[1];
      if (!name || src.slice(pos, pos + name.length) !== name) continue;
      let end = pos + name.length;
      const t = typeFor(name);
      // an arrow function with one bare parameter (`m => ...`) needs parentheses around the annotated parameter
      let param = null;
      (function w(n) { if (ts.isParameter(n) && n.getStart(sf) === pos && !param) param = n; ts.forEachChild(n, w); })(sf);
      const bare = param && ts.isArrowFunction(param.parent) && !param.parent.getChildren(sf).some(c => c.kind === ts.SyntaxKind.OpenParenToken);
      if (bare) { edits.push({ at: pos, text: '(' }, { at: end, text: ': ' + t + ')' }); }
      else {
        if (src[end] === '?') end++; // optional parameter: the type goes after the ?
        edits.push({ at: end, text: ': ' + t });
      }
      if (t !== 'any') needed.add(t);
    } else if (e.code === 'TS7034') {
      const name = (e.msg.match(/Variable '(\w+)'/) || [])[1];
      if (!name || src.slice(pos, pos + name.length) !== name) continue;
      edits.push({ at: pos + name.length, text: ': any' });
    } else if (e.code === 'TS7053') {
      // find the element access expression that starts at pos
      let found = null;
      (function w(n) { if (ts.isElementAccessExpression(n) && n.getStart(sf) === pos && !found) found = n; ts.forEachChild(n, w); })(sf);
      if (!found) continue;
      const ex = found.expression;
      edits.push({ at: ex.getStart(sf), text: '(' }, { at: ex.getEnd(), text: ' as any)' });
    } else if (e.code === 'TS7018') {
      let found = null;
      (function w(n) { if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.getStart(sf) === pos && !found) found = n; ts.forEachChild(n, w); })(sf);
      if (found && ts.isPropertyAssignment(found)) edits.push({ at: found.initializer.getEnd(), text: ' as any' });
    }
  }
  // de-duplicate identical insertions at the same place
  const seen = new Set(); const uniq = edits.filter(e => { const k = e.at + '|' + e.text; if (seen.has(k)) return false; seen.add(k); return true; });
  uniq.sort((a, b) => b.at - a.at);
  let out = src;
  for (const e of uniq) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  // imports of the entity types this file now names
  if (needed.size) {
    const rel = path.relative(path.dirname(abs), path.join(root, 'server/entities/types')).replace(/\\/g, '/');
    const spec = rel.startsWith('.') ? rel : './' + rel;
    const existing = out.match(/^import type \{([^}]*)\} from '[^']*entities\/types';$/m);
    if (existing) {
      const have = new Set(existing[1].split(',').map(s => s.trim()).filter(Boolean));
      for (const n of needed) have.add(n);
      out = out.replace(existing[0], `import type { ${[...have].join(', ')} } from '${spec}';`);
    } else {
      const lastImport = [...out.matchAll(/^(?:import|\}) [^\n]*from '[^']+';$/gm)].pop();
      const at = lastImport ? lastImport.index + lastImport[0].length : 0;
      out = out.slice(0, at) + `\nimport type { ${[...needed].join(', ')} } from '${spec}';` + out.slice(at);
    }
  }
  total += uniq.length;
  for (const n of needed) typeUse.set(n, (typeUse.get(n) || 0) + 1);
  if (!dry) fs.writeFileSync(abs, out.replace(/\n/g, eol));
}
console.log(`${total} edits in ${byFile.size} files`);
