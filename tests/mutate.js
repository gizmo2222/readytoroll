// Mutation check: does the suite notice when the code is broken?
// Each mutant replaces one exact snippet in one app file, serves the mutated copy from a temp folder,
// and runs the given spec files against it. A mutant is "killed" when those specs fail.
//
//   node tests/mutate.js tests/mutants/skills.json [more.json ...] [--port 4301] [--only id1,id2]
//
// Mutant file: [{ "id": "skills-1", "file": "readytoroll.html", "find": "exact text (must occur once)",
//                 "replace": "broken text", "spec": ["tests/skills.spec.js"], "why": "what it breaks" }]
// Report: coverage/mutation-<port>.txt. Exit code 1 if any mutant survived or a mutant was invalid.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = Number(opt('--port', 4300));
const only = (opt('--only', '') || '').split(',').filter(Boolean);
const mutants = args.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).map(m => ({ ...m, from: f })))
  .filter(m => !only.length || only.includes(m.id));
if (!mutants.length) { console.error('usage: node tests/mutate.js <mutants.json ...> [--port N] [--only ids]'); process.exit(2); }

const tmp = path.join(repo, 'coverage', `mutant-root-${port}`);
const APP_FILES = fs.readdirSync(repo).filter(f => /^(readytoroll\.html|rtr-[\w.-]+|version\.txt)$/.test(f));

function prepare(mutant) {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of APP_FILES) fs.copyFileSync(path.join(repo, f), path.join(tmp, f));
  if (!mutant) return null;
  const file = path.join(tmp, mutant.file || 'readytoroll.html');
  const src = fs.readFileSync(file, 'utf8');
  const n = src.split(mutant.find).length - 1;
  if (n !== 1) return `find text occurs ${n} times (must be exactly once)`;
  fs.writeFileSync(file, src.replace(mutant.find, () => mutant.replace));
  return null;
}

function run(specs) {
  const env = { ...process.env, RTR_SERVE_ROOT: tmp, RTR_TEST_PORT: String(port), CI: '1' };
  delete env.RTR_COVERAGE;
  const r = spawnSync('npx', ['playwright', 'test', ...specs, '--reporter=dot', '--retries=0'],
    { cwd: repo, env, encoding: 'utf8', shell: true, timeout: 300000 });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

const lines = [];
const log = s => { console.log(s); lines.push(s); };
// Baseline: the specs must pass on an unmutated copy, or every mutant would look killed
const allSpecs = [...new Set(mutants.flatMap(m => m.spec))];
prepare(null);
const base = run(allSpecs);
if (!base.ok) { log('BASELINE FAILED on the unmutated copy:\n' + base.out.slice(-3000)); process.exit(2); }

let survived = 0, invalid = 0, killed = 0;
for (const m of mutants) {
  const bad = prepare(m);
  if (bad) { invalid++; log(`INVALID   ${m.id}: ${bad}`); continue; }
  const r = run(m.spec);
  if (r.ok) { survived++; log(`SURVIVED  ${m.id}: ${m.why}`); } else { killed++; log(`killed    ${m.id}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
log(`\n${killed} killed, ${survived} survived, ${invalid} invalid, of ${mutants.length} mutants.`);
fs.writeFileSync(path.join(repo, 'coverage', `mutation-${port}.txt`), lines.join('\n') + '\n');
process.exit(survived || invalid ? 1 : 0);
