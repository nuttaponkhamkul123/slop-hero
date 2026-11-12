// Phase D3: turns the first `switch (skill.spShape)` of SpSkillSystem.castSpSkill into SP_SHAPE_HANDLERS
// (server/skills/spShapeHandlers.ts), one handler per shape, and makes the switch a lookup.
// The helpers castSpSkill builds before the switch (hit, emit, say, placeRune, ...) become fields of one context
// object; the few preamble variables a shape assigns (dealt, spot, ...) are exposed through getters/setters, so
// the shapes keep sharing them with the code after the switch.
// Every case body is copied as is: `this.gs.` becomes `gs.`, the context names it uses are destructured at the
// top of the handler, and a `break` that ended the case becomes `return`.
// Usage: TS_PATH=<typescript 5.x> node scripts/extract-sp-handlers.js [--dry]
const fs = require('fs');
const path = require('path');
const ts = require(process.env.TS_PATH || 'typescript');

const root = path.join(__dirname, '..');
const sysPath = path.join(root, 'server/systems/SpSkillSystem.ts');
const outPath = path.join(root, 'server/skills/spShapeHandlers.ts');
const dry = process.argv.includes('--dry');

const raw = fs.readFileSync(sysPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const src = raw.replace(/\r\n/g, '\n');
const sf = ts.createSourceFile('SpSkillSystem.ts', src, ts.ScriptTarget.Latest, true);

let method = null;
(function find(n) { if (ts.isMethodDeclaration(n) && n.name.getText(sf) === 'castSpSkill') method = n; ts.forEachChild(n, find); })(sf);
if (!method) throw new Error('castSpSkill not found');
const body = method.body;
const swIdx = body.statements.findIndex(s => ts.isSwitchStatement(s) && s.expression.getText(sf) === 'skill.spShape');
if (swIdx < 0) throw new Error('switch not found');
const sw = body.statements[swIdx];
const pre = body.statements.slice(0, swIdx);

// names declared by the preamble (and whether declared with let)
const preNames = new Map(); // name -> 'let' | 'const' | 'param'
function declNames(nameNode, kind) {
  if (ts.isIdentifier(nameNode)) preNames.set(nameNode.text, kind);
  else if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) for (const el of nameNode.elements) if (!ts.isOmittedExpression(el)) declNames(el.name, kind);
}
for (const p of method.parameters) declNames(p.name, 'param');
for (const s of pre) {
  if (ts.isVariableStatement(s)) {
    const kind = (s.declarationList.flags & ts.NodeFlags.Let) ? 'let' : 'const';
    for (const d of s.declarationList.declarations) declNames(d.name, kind);
  } else if (ts.isFunctionDeclaration(s) && s.name) preNames.set(s.name.text, 'const');
}

// group fall-through labels
const groups = []; let pending = [];
for (const clause of sw.caseBlock.clauses) {
  if (ts.isDefaultClause(clause)) throw new Error('unexpected default clause');
  pending.push(clause.expression.getText(sf).replace(/^'|'$/g, ''));
  if (clause.statements.length) { groups.push({ keys: pending, clause }); pending = []; }
}
if (pending.length) throw new Error('trailing empty case labels');

const isAssignOp = k => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;
function declaredIn(node) { // names declared anywhere inside node
  const out = new Set();
  (function w(n) {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && n.name) {
      (function names(nm) { if (ts.isIdentifier(nm)) out.add(nm.text); else if (nm.elements) for (const e of nm.elements) if (!ts.isOmittedExpression(e)) names(e.name); })(n.name);
    }
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name) out.add(n.name.text);
    ts.forEachChild(n, w);
  })(node);
  return out;
}

// every preamble `let` is shared through accessors: the helpers built before the switch (hit, ...) assign them too,
// so a copy taken when a handler starts could be stale
const mutated = new Set([...preNames].filter(([, kind]) => kind === 'let').map(([n]) => n));
console.error('mutated preamble variables:', [...mutated].join(', ') || '(none)');

const handlers = [];
for (const g of groups) {
  const clause = g.clause;
  let stmts = clause.statements, block = null;
  if (stmts.length === 1 && ts.isBlock(stmts[0])) { block = stmts[0]; stmts = block.statements; }
  const local = declaredIn(clause);
  const edits = []; // { start, end, text } on absolute offsets
  const baseStart = stmts[0].getStart(sf), baseEnd = stmts[stmts.length - 1].getEnd();
  const lastStmt = stmts[stmts.length - 1];
  const trailing = ts.isBreakStatement(lastStmt) && !lastStmt.label ? lastStmt : null;
  const used = new Set();
  (function walk(n, breakable, inFn) {
    if (ts.isFunctionLike(n) && n !== clause) { breakable = true; inFn = true; }
    if (ts.isIterationStatement(n, false) || ts.isSwitchStatement(n)) breakable = true;
    if (ts.isBreakStatement(n) && !n.label && !breakable) {
      if (n === trailing) edits.push({ start: n.getStart(sf), end: n.getEnd(), text: '', trailing: true });
      else edits.push({ start: n.getStart(sf), end: n.getEnd(), text: 'return;' });
    }
    if (ts.isReturnStatement(n) && !inFn) throw new Error('top-level return in case ' + g.keys.join(',') + ' (it would skip the code after the switch)');
    if (n.kind === ts.SyntaxKind.ThisKeyword) {
      // only `this.gs` is allowed
      const p = n.parent;
      if (!(ts.isPropertyAccessExpression(p) && p.name.text === 'gs')) throw new Error('`this` used in case ' + g.keys.join(','));
    }
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) { if (n.getText(sf).includes('\n')) throw new Error('multi-line template in case ' + g.keys.join(',')); }
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n)
        || (ts.isBindingElement(p) && p.propertyName === n);
      const isDecl = (ts.isVariableDeclaration(p) && p.name === n) || (ts.isParameter(p) && p.name === n) || (ts.isBindingElement(p) && p.name === n && !p.propertyName)
        || ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)) && p.name === n);
      if (!isPropName && !isDecl && preNames.has(n.text) && !local.has(n.text)) {
        used.add(n.text);
        if (mutated.has(n.text)) {
          if (ts.isShorthandPropertyAssignment(p)) edits.push({ start: n.getStart(sf), end: n.getEnd(), text: `${n.text}: c.${n.text}` });
          else edits.push({ start: n.getStart(sf), end: n.getEnd(), text: `c.${n.text}` });
        }
      } else if (!isPropName && !isDecl && preNames.has(n.text) && local.has(n.text)) {
        throw new Error(`name "${n.text}" is declared in case ${g.keys.join(',')} and also exists in the preamble`);
      }
    }
    ts.forEachChild(n, c => walk(c, breakable, inFn));
  })(clause, false, false);
  // `this.gs` -> `gs` (as an edit on the property access)
  (function w(n) {
    if (ts.isPropertyAccessExpression(n) && n.expression.kind === ts.SyntaxKind.ThisKeyword && n.name.text === 'gs') edits.push({ start: n.getStart(sf), end: n.getEnd(), text: 'gs' });
    ts.forEachChild(n, w);
  })(clause);
  let text = src.slice(baseStart, baseEnd);
  for (const e of edits.filter(e => e.start >= baseStart && e.end <= baseEnd).sort((a, b) => b.start - a.start)) {
    let s = e.start - baseStart, en = e.end - baseStart;
    if (e.trailing) { text = text.slice(0, s).replace(/\s+$/, '') + text.slice(en); } else text = text.slice(0, s) + e.text + text.slice(en);
  }
  const fields = ['gs', ...[...used].filter(u => !mutated.has(u)).sort()];
  const needsC = [...used].some(u => mutated.has(u));
  const lines = text.split('\n').map((l, i) => (i === 0 ? l : l.replace(/^ {0,4}/, '')));
  handlers.push({ keys: g.keys, fields, needsC, body: lines.join('\n') });
}

// imports used by the handlers
const allText = handlers.map(h => h.body).join('\n');
const importLines = [];
for (const m of src.matchAll(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';$/gm)) {
  if (m[0].includes('GameServer')) continue;
  const spec = m[1];
  const used = id => new RegExp('(?<![\\w.])' + id + '\\b').test(allText);
  let mm;
  if ((mm = spec.match(/^\*\s+as\s+(\w+)$/))) { if (used(mm[1])) importLines.push(`import * as ${mm[1]} from '${m[2]}';`); continue; }
  const named = (spec.match(/\{([\s\S]*)\}/) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean).filter(used);
  if (named.length) importLines.push(`import { ${named.join(', ')} } from '${m[2]}';`);
}
// module-level declarations of SpSkillSystem.ts the handlers use (spObjSeq)
const moduleLets = [];
for (const s of sf.statements) {
  if (ts.isVariableStatement(s)) {
    for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && new RegExp('(?<![\\w.])' + d.name.text + '\\b').test(allText)) moduleLets.push(s.getText(sf));
  }
}

const allPre = [...preNames.keys()].filter(n => !['player', 'skill', 'ctx'].includes(n));
const out = [
  '// One handler per Specialist skill shape (Phase D3 of docs/REFACTOR_PLAN.md): the cases of the old switch in castSpSkill.',
  '// A handler gets the cast context built by castSpSkill: the caster, the skill, and the helpers (hit, emit, say, ...).',
  ...importLines,
  ...moduleLets,
  '',
  '// The context is a loose bag of what castSpSkill prepared; the names are those of its old local variables.',
  'export interface SpCastContext {',
  '  gs: any; player: any; skill: any; ctx: any;',
  '  [name: string]: any;',
  '}',
  '',
  'export type SpShapeHandler = (c: SpCastContext) => void;',
  '',
  'export const SP_SHAPE_HANDLERS: Record<string, SpShapeHandler> = {',
  ...(() => {
    const entries = [];
    for (const h of handlers) {
      const first = h.keys[0];
      const key = k => (/^[a-z_]\w*$/i.test(k) ? k : `'${k}'`);
      const fields = ['player', 'skill', ...h.fields];
      const head = `  ${key(first)}: (c) => {\n    const { ${[...new Set(fields)].join(', ')} } = c;\n    ${h.body}\n  }`;
      entries.push(head);
      for (const k of h.keys.slice(1)) entries.push(`  ${key(k)}: (c) => SP_SHAPE_HANDLERS.${first}(c)`);
    }
    return entries.map((e, i) => e + (i < entries.length - 1 ? ',' : '') + '\n');
  })(),
  '};',
  ''
].join('\n');

// castSpSkill: build the context and look the shape up
const accessors = [...mutated].map(n => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`);
const plainNames = allPre.filter(n => !mutated.has(n));
const dispatch = [
  `const spCtx = {`,
  `      gs: this.gs, player, skill, ctx,`,
  `      ${plainNames.join(', ')},`,
  `      ${accessors.join(',\n      ')}`,
  `    };`,
  `    const shapeHandler = Object.prototype.hasOwnProperty.call(SP_SHAPE_HANDLERS, skill.spShape) ? SP_SHAPE_HANDLERS[skill.spShape] : null;`,
  `    if (shapeHandler) shapeHandler(spCtx);`
].join('\n');
let next = src.slice(0, sw.getStart(sf)) + dispatch + src.slice(sw.getEnd());
next = next.replace("import type { GameServer } from '../gameServer';", "import type { GameServer } from '../gameServer';\nimport { SP_SHAPE_HANDLERS } from '../skills/spShapeHandlers';");

console.log(`${handlers.length} handler bodies for ${handlers.reduce((t, h) => t + h.keys.length, 0)} shapes; imports kept ${importLines.length}`);
if (!dry) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.replace(/\n/g, eol));
  fs.writeFileSync(sysPath, next.replace(/\n/g, eol));
}
