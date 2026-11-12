// Phase D2: turns the `switch (skill.spShape ? 'sp_skill' : skill.id)` of SkillSystem.handlePlayerSkill into
// BASE_SKILL_HANDLERS (server/skills/baseSkillHandlers.ts), one handler per case, and makes the switch a lookup.
// Mechanical: every case body is copied as is, except that `this.gs.` becomes `gs.`, the locals the body uses are
// read from the context object, and a `break` that ended the case becomes `return`.
// Usage: node scripts/extract-skill-handlers.js [--dry]
const fs = require('fs');
const path = require('path');
// the project's TypeScript 7 has no JS API: point TS_PATH at a TypeScript 5.x install (npm i typescript@5 in a scratch folder)
const ts = require(process.env.TS_PATH || 'typescript');

const root = path.join(__dirname, '..');
const sysPath = path.join(root, 'server/systems/SkillSystem.ts');
const outPath = path.join(root, 'server/skills/baseSkillHandlers.ts');
const dry = process.argv.includes('--dry');

const raw = fs.readFileSync(sysPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const src = raw.replace(/\r\n/g, '\n');
const sf = ts.createSourceFile('SkillSystem.ts', src, ts.ScriptTarget.Latest, true);

let sw = null;
(function find(n) {
  if (ts.isSwitchStatement(n) && n.expression.getText(sf) === "skill.spShape ? 'sp_skill' : skill.id") sw = n;
  ts.forEachChild(n, find);
})(sf);
if (!sw) throw new Error('switch not found');

const CANDIDATES = ['skill', 'player', 'slot', 'rawSlot', 'cooldown', 'runeId', 'mobsMap', 'playerTalents', 'skillData', 'socket', 'recall',
  'applySkillDamage', 'computeDashVector', 'mpCost', 'runeCounts', 'skillCritChance', 'socket0', 'skillId'];

function identifiersUsed(node) {
  const used = new Set();
  (function walk(n) {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n);
      if (!isPropName) used.add(n.text);
    }
    ts.forEachChild(n, walk);
  })(node);
  return used;
}

const handlers = [];
for (const clause of sw.caseBlock.clauses) {
  if (ts.isDefaultClause(clause)) throw new Error('unexpected default clause');
  const key = clause.expression.getText(sf).replace(/^'|'$/g, '');
  let stmts = clause.statements;
  let block = null;
  if (stmts.length === 1 && ts.isBlock(stmts[0])) { block = stmts[0]; stmts = block.statements; }
  if (!stmts.length) throw new Error('empty case ' + key);
  // find the breaks that leave this case (not the ones inside a loop or a nested switch or a function)
  const edits = [];
  function walk(n, breakable) {
    if (ts.isFunctionLike(n) && n !== clause) { breakable = true; }
    if (ts.isIterationStatement(n, false) || ts.isSwitchStatement(n)) breakable = true;
    if (ts.isBreakStatement(n) && !n.label && !breakable) edits.push(n);
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) { if (n.getText(sf).includes('\n')) throw new Error('multi-line template in case ' + key); }
    ts.forEachChild(n, c => walk(c, breakable));
  }
  for (const s of stmts) walk(s, false);
  const first = stmts[0].getFullStart(), last = stmts[stmts.length - 1].getEnd();
  let body = src.slice(stmts[0].getStart(sf), last);
  const base = stmts[0].getStart(sf);
  // apply edits from the end
  const lastStmt = stmts[stmts.length - 1];
  const trailing = ts.isBreakStatement(lastStmt) && !lastStmt.label ? lastStmt : null;
  for (const b of edits.sort((a, c) => c.getStart(sf) - a.getStart(sf))) {
    const s = b.getStart(sf) - base, e = b.getEnd() - base;
    if (b === trailing) body = body.slice(0, s).replace(/\s+$/, '') + body.slice(e);
    else body = body.slice(0, s) + 'return;' + body.slice(e);
  }
  body = body.replace(/this\.gs\./g, 'gs.').replace(/this\.gs\b/g, 'gs');
  if (/\bthis\b/.test(body)) throw new Error('this left in case ' + key);
  const used = new Set(); for (const s of stmts) for (const id of identifiersUsed(s)) used.add(id);
  const fields = ['gs', ...CANDIDATES.filter(c => used.has(c))];
  // statements start at the clause's inner indentation (8 spaces for a block, 6 otherwise): dedent to 4
  const indent = block ? 8 : 8;
  const lines = body.split('\n').map((l, i) => (i === 0 ? l : l.replace(new RegExp('^ {0,' + (indent - 4) + '}'), '')));
  handlers.push({ key, fields, body: lines.join('\n'), used });
}

// imports: keep the ones the handlers use
const importLines = [];
for (const m of src.matchAll(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';$/gm)) {
  if (m[0].includes('GameServer')) continue;
  const spec = m[1];
  const allText = handlers.map(h => h.body).join('\n');
  const used = id => new RegExp('(?<![\\w.])' + id + '\\b').test(allText);
  let mm;
  if ((mm = spec.match(/^\*\s+as\s+(\w+)$/))) { if (used(mm[1])) importLines.push(`import * as ${mm[1]} from '${m[2].replace('../', '../')}';`); continue; }
  const named = (spec.match(/\{([\s\S]*)\}/) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean).filter(used);
  if (named.length) importLines.push(`import { ${named.join(', ')} } from '${m[2]}';`);
}

const out = [
  '// One handler per class skill (Phase D2 of docs/REFACTOR_PLAN.md): the cases of the old switch in handlePlayerSkill.',
  '// A handler gets a context with the server (gs), the caster and everything the cast worked out before the switch.',
  ...importLines,
  '',
  'export interface SkillContext {',
  '  gs: any; player: any; skill: any; slot: string; rawSlot: string; cooldown: number; runeId: string; mobsMap: Map<string, any>;',
  '  playerTalents: any; skillData: any; socket: any; recall: boolean; applySkillDamage: (mob: any, baseDmg: number, canCrit?: boolean) => void;',
  '  computeDashVector: () => { normX: number; normY: number }; mpCost: number; runeCounts: any; skillCritChance: number; socket0: any; skillId: string;',
  '}',
  '',
  'export type SkillHandler = (c: SkillContext) => void;',
  '',
  'export const BASE_SKILL_HANDLERS: Record<string, SkillHandler> = {',
  ...handlers.map((h, i) => `  ${/^[a-z_]\w*$/i.test(h.key) ? h.key : `'${h.key}'`}: (c) => {\n    const { ${h.fields.join(', ')} } = c;\n    ${h.body}\n  }${i < handlers.length - 1 ? ',' : ''}\n`),
  '};',
  ''
].join('\n');

// the switch becomes a lookup
const swStart = sw.getStart(sf), swEnd = sw.getEnd();
const dispatch = [
  "const handler = Object.prototype.hasOwnProperty.call(BASE_SKILL_HANDLERS, skill.spShape ? 'sp_skill' : skill.id) ? BASE_SKILL_HANDLERS[skill.spShape ? 'sp_skill' : skill.id] : null;",
  '    if (handler) {',
  '      handler({ gs: this.gs, player, skill, slot, rawSlot, cooldown, runeId, mobsMap, playerTalents, skillData, socket, recall, applySkillDamage, computeDashVector, mpCost, runeCounts, skillCritChance, socket0, skillId });',
  '    }'
].join('\n');
let next = src.slice(0, swStart) + dispatch + src.slice(swEnd);
next = next.replace("import type { GameServer } from '../gameServer';", "import type { GameServer } from '../gameServer';\nimport { BASE_SKILL_HANDLERS } from '../skills/baseSkillHandlers';");

console.log(`${handlers.length} handlers; imports kept ${importLines.length}`);
if (!dry) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.replace(/\n/g, eol));
  fs.writeFileSync(sysPath, next.replace(/\n/g, eol));
}
