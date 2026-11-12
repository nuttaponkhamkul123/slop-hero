// Mechanical "extract methods of GameServer into a system class" tool (Phase C of docs/REFACTOR_PLAN.md).
//   node scripts/extract-system.js scripts/system-configs/<name>.json        (or pass the JSON inline)
// config: { className, field, description, methods: [names], extraTop: [lines], privateFields: [lines],
//           textReplacements: [[from, to]], deleteLines: [exact GameServer lines to remove], dry: bool }
// - moves each method (with its leading // comment) into server/systems/<className>.ts, `this` -> `this.gs` (code only,
//   never inside strings or comments), prunes the copied imports to what the new file uses
// - leaves a one-line forwarding stub in GameServer at the same place (so no call site changes)
// - wires `this.<field> = new <className>(this)` into GameServer.initSystems()
// Run it on a clean tree, then typecheck / test / smoke / e2e; `git checkout -- server/gameServer.ts` undoes it.
const fs = require('fs');
const path = require('path');
const arg = process.argv[2];
const cfg = JSON.parse(arg.endsWith('.json') ? fs.readFileSync(arg, 'utf8') : arg);
const GS = 'server/gameServer.ts';
const raw = fs.readFileSync(GS, 'utf8');
const crlf = raw.includes('\r\n');
const NL = crlf ? '\r\n' : '\n';
const lines = raw.split(NL);
const must = (c, m) => { if (!c) throw new Error(m); };

// ---- locate methods (2-space indented, ending at the next line that is exactly "  }")
function locate(name) {
  const re = new RegExp('^  ' + name + '\\(');
  const starts = lines.map((l, i) => (re.test(l) ? i : -1)).filter(i => i >= 0);
  must(starts.length === 1, `method ${name}: expected exactly one definition, found ${starts.length}`);
  const s = starts[0];
  // the signature may span several lines: find the line ending the signature with "{"
  const oneLiner = /^  [A-Za-z_]\w*\(.*\)\s*\{.*\}\s*$/.test(lines[s]);
  let sigEnd = s; if (!oneLiner) while (!/\{\s*$/.test(lines[sigEnd])) sigEnd++;
  let e = sigEnd; if (!oneLiner) while (lines[e] !== '  }') { e++; must(e < lines.length, name + ': no end'); }
  // leading comment block directly above
  let c = s; while (c > 0 && /^  \/\//.test(lines[c - 1])) c--;
  return { name, c, s, sigEnd, e };
}
const located = cfg.methods.map(locate);
located.sort((a, b) => a.c - b.c);
for (let i = 1; i < located.length; i++) must(located[i].c > located[i - 1].e, 'overlapping methods');

// ---- `this` -> `this.gs` in code only (not in strings / comments / regex-free heuristic)
function transformThis(src) {
  let out = '', i = 0, state = 'code'; const stack = [];
  const n = src.length;
  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && nx === '/') { state = 'line'; out += '//'; i += 2; continue; }
      if (ch === '/' && nx === '*') { state = 'block'; out += '/*'; i += 2; continue; }
      if (ch === "'" || ch === '"') { state = ch; out += ch; i++; continue; }
      if (ch === '`') { state = 'tpl'; out += ch; i++; continue; }
      if (ch === '{' && stack.length) { stack[stack.length - 1]++; out += ch; i++; continue; }
      if (ch === '}' && stack.length) {
        if (stack[stack.length - 1] === 0) { stack.pop(); state = 'tpl'; out += ch; i++; continue; }
        stack[stack.length - 1]--; out += ch; i++; continue;
      }
      if (src.startsWith('this', i) && !/[A-Za-z0-9_$]/.test(src[i - 1] || ' ') && !/[A-Za-z0-9_$]/.test(src[i + 4] || ' ')) { out += 'this.gs'; i += 4; continue; }
      out += ch; i++; continue;
    }
    if (state === 'line') { out += ch; if (ch === '\n') state = 'code'; i++; continue; }
    if (state === 'block') { if (ch === '*' && nx === '/') { out += '*/'; i += 2; state = 'code'; continue; } out += ch; i++; continue; }
    if (state === "'" || state === '"') {
      if (ch === '\\') { out += ch + (nx || ''); i += 2; continue; }
      if (ch === state) state = 'code';
      out += ch; i++; continue;
    }
    if (state === 'tpl') {
      if (ch === '\\') { out += ch + (nx || ''); i += 2; continue; }
      if (ch === '$' && nx === '{') { out += '${'; i += 2; state = 'code'; stack.push(0); continue; }
      if (ch === '`') state = 'code';
      out += ch; i++; continue;
    }
  }
  return out;
}

// ---- params of a signature -> argument names
function paramNames(sigText) {
  const open = sigText.indexOf('('); let depth = 0, end = -1;
  for (let i = open; i < sigText.length; i++) { const ch = sigText[i]; if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } } }
  const inner = sigText.slice(open + 1, end); const parts = []; let cur = '', d = 0;
  for (const ch of inner) { if ('([{<'.includes(ch)) d++; if (')]}>'.includes(ch)) d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  if (cur.trim()) parts.push(cur);
  return { names: parts.map(p => p.trim().replace(/^\.\.\./, '').split(/[:=?]/)[0].trim()).filter(Boolean), spread: parts.some(p => p.trim().startsWith('...')), inner: inner.trim() };
}

// ---- build the system body
const methodTexts = [];
const stubs = [];
for (const m of located) {
  const block = lines.slice(m.c, m.e + 1).join('\n');
  const bodyT = transformThis(block);
  methodTexts.push(bodyT);
  const sig = lines.slice(m.s, m.sigEnd + 1).join(' ');
  const { names, spread } = paramNames(sig);
  const sigNoBrace = m.s === m.e ? lines[m.s].replace(/\s*\{.*$/, '') : lines.slice(m.s, m.sigEnd + 1).join(NL).replace(/\s*\{\s*$/, '');
  const call = spread ? `...${names[names.length - 1]}` : null;
  const args = names.map((n, i) => (spread && i === names.length - 1 ? `...${n}` : n)).join(', ');
  stubs.push({ m, text: [`${sigNoBrace} {`, `    return this.${cfg.field}.${m.name}(${args});`, '  }'].join(NL) });
}
let classBody = methodTexts.join('\n\n');
for (const [from, to] of (cfg.textReplacements || [])) {
  const parts = classBody.split(from);
  must(parts.length === 2, 'textReplacement must match exactly once: ' + from + ' (found ' + (parts.length - 1) + ')');
  classBody = parts.join(to);
}

// ---- imports copied from GameServer, pruned to what the new file uses
const classIdx = lines.findIndex(l => l.startsWith('class GameServer'));
const head = lines.slice(0, classIdx).join('\n');
const importRe = /^import\s+([\s\S]*?)\s+from\s+'([^']+)';/gm;
let im; const imports = [];
const usedText = classBody + '\n' + (cfg.extraTop || []).join('\n') + '\n' + (cfg.privateFields || []).join('\n');
const used = id => new RegExp('(^|[^A-Za-z0-9_$.])' + id.replace(/\$/g, '\\$') + '($|[^A-Za-z0-9_$])').test(usedText);
while ((im = importRe.exec(head))) {
  let spec = im[1].trim(); let from = im[2];
  if (from.startsWith('./')) from = '../' + from.slice(2);
  if (/^\*\s+as\s+/.test(spec)) { const id = spec.replace(/^\*\s+as\s+/, '').trim(); if (used(id)) imports.push(`import * as ${id} from '${from}';`); continue; }
  let def = null, named = [];
  const m1 = spec.match(/^([A-Za-z_$][\w$]*)\s*(?:,\s*)?(\{[\s\S]*\})?$/);
  if (m1 && !spec.startsWith('{')) { def = m1[1]; if (m1[2]) named = m1[2].slice(1, -1).split(',').map(s => s.trim()).filter(Boolean); }
  else if (spec.startsWith('{')) named = spec.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  named = named.filter(s => used(s.split(/\s+as\s+/).pop().trim()));
  if (def && !used(def)) def = null;
  if (!def && !named.length) continue;
  imports.push(`import ${[def, named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean).join(', ')} from '${from}';`);
}
const file = [
  `// ${cfg.description}`,
  `// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): \`this\` is the server, reached as this.gs;`,
  `// GameServer keeps one-line forwarding methods, so no call site changed.`,
  `import type { GameServer } from '../gameServer';`,
  ...imports,
  ...(cfg.extraTop || []),
  '',
  `export class ${cfg.className} {`,
  ...(cfg.privateFields || []).map(l => '  ' + l),
  `  constructor(private readonly gs: GameServer) {}`,
  '',
  classBody,
  '}',
  ''
].join('\n');

if (cfg.dry) { console.log(file); process.exit(0); }
fs.mkdirSync('server/systems', { recursive: true });
fs.writeFileSync(`server/systems/${cfg.className}.ts`, file, 'utf8');

// ---- rewrite GameServer: stubs (bottom-up), import, initSystems wiring
const out = lines.slice();
for (const st of stubs.slice().reverse()) out.splice(st.m.c, st.m.e - st.m.c + 1, ...st.text.split(NL));
for (const del of (cfg.deleteLines || [])) {
  const idx = out.map((l, i) => (l === del ? i : -1)).filter(i => i >= 0);
  must(idx.length === 1, 'deleteLines must match exactly one line: ' + del + ' (found ' + idx.length + ')');
  out.splice(idx[0], 1);
}
// import after the last './entities/...' / './systems/...' import or the world import
let impAt = out.findIndex(l => l.startsWith("import { createProjectile"));
must(impAt >= 0, 'import anchor');
const sysImports = out.map((l, i) => (l.startsWith("import { ") && l.includes("from './systems/") ? i : -1)).filter(i => i >= 0);
if (sysImports.length) impAt = sysImports[sysImports.length - 1];
out.splice(impAt + 1, 0, `import { ${cfg.className} } from './systems/${cfg.className}';`);
// initSystems()
let init = out.findIndex(l => l === '  initSystems() {');
if (init < 0) {
  const ctor = out.findIndex(l => l === '  constructor(io) {');
  must(ctor >= 0, 'constructor anchor');
  const ioLine = out.findIndex((l, i) => i > ctor && l === '    this.io = io;');
  must(ioLine >= 0, 'this.io anchor');
  out.splice(ioLine + 1, 0, '    this.initSystems();');
  // initSystems method placed right before savePlayerAccount
  const spa = out.findIndex(l => l.startsWith('  savePlayerAccount('));
  must(spa >= 0, 'savePlayerAccount anchor');
  out.splice(spa, 0, '  // Game systems: classes that own one area of the rules (see server/systems). Each reaches the server through `gs`.', '  initSystems() {', '  }', '');
  init = out.findIndex(l => l === '  initSystems() {');
}
out.splice(init + 1, 0, `    this.${cfg.field} = new ${cfg.className}(this);`);
fs.writeFileSync(GS, out.join(NL), 'utf8');
console.log(`moved ${located.length} methods into server/systems/${cfg.className}.ts (${classBody.split('\n').length} lines); imports kept: ${imports.length}`);
