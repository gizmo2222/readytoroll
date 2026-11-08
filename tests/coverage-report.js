// Merge the V8 coverage written by RTR_COVERAGE=1 runs (coverage/raw/*.json) into a per-function report
// for the inline <script> of readytoroll.html. Writes coverage/report.txt and prints the summary.
//   $env:RTR_COVERAGE = '1'; npx playwright test --reporter=dot; Remove-Item Env:RTR_COVERAGE
//   node tests/coverage-report.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rawDir = path.join(root, 'coverage', 'raw');
const html = fs.readFileSync(path.join(root, 'readytoroll.html'), 'utf8');

const files = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter(f => f.endsWith('.json')) : [];
if (!files.length) { console.error('No coverage in coverage/raw. Run the suite with RTR_COVERAGE=1 first.'); process.exit(1); }

// The app's main inline script is the largest one in the page
let source = null, covered = null;
const fnHits = new Map();   // "name@offset" -> { name, start, end, tests: Set }

for (const f of files) {
  const { title, entries } = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
  for (const e of entries) {
    if (!e.source || e.source.length < 50000) continue;
    if (source === null) { source = e.source; covered = new Uint8Array(source.length); }
    if (e.source !== source) continue;
    // Block ranges nest: apply in order (V8 lists outer before inner), innermost count wins
    const counts = new Int32Array(source.length).fill(-1);
    for (const fn of e.functions) for (const r of fn.ranges) counts.fill(r.count, r.startOffset, r.endOffset);
    for (let i = 0; i < counts.length; i++) if (counts[i] > 0) covered[i] = 1;
    for (const fn of e.functions) {
      const r = fn.ranges[0];
      if (!fn.functionName || r.endOffset - r.startOffset >= source.length - 10) continue;
      const key = fn.functionName + '@' + r.startOffset;
      if (!fnHits.has(key)) fnHits.set(key, { name: fn.functionName, start: r.startOffset, end: r.endOffset, tests: new Set() });
      if (r.count > 0) fnHits.get(key).tests.add(title);
    }
  }
}
if (source === null) { console.error('No readytoroll.html script coverage found.'); process.exit(1); }

const base = html.indexOf(source);
const lineOf = off => html.slice(0, (base < 0 ? 0 : base) + off).split('\n').length;
const srcLines = source.split('\n');
let pos = 0, codeLines = 0, hitLines = 0;
const uncoveredLines = [];
for (const line of srcLines) {
  const t = line.trim();
  if (t && !t.startsWith('//') && t !== '}' && t !== '});' && t !== '};') {
    codeLines++;
    let hit = false;
    for (let i = pos; i < pos + line.length; i++) if (!/\s/.test(source[i]) && covered[i]) { hit = true; break; }
    if (hit) hitLines++; else uncoveredLines.push(lineOf(pos));
  }
  pos += line.length + 1;
}

const fns = [...fnHits.values()].sort((a, b) => a.start - b.start);
const never = fns.filter(f => f.tests.size === 0);
const out = [];
out.push(`readytoroll.html inline script: ${hitLines}/${codeLines} code lines executed (${(100 * hitLines / codeLines).toFixed(1)}%), ` +
  `${fns.length - never.length}/${fns.length} named functions called, ${files.length} test pages.`);
out.push('', 'Named functions never called:');
for (const f of never) out.push(`  ${String(lineOf(f.start)).padStart(5)}  ${f.name}  (${lineOf(f.end) - lineOf(f.start) + 1} lines)`);
out.push('', 'Named functions called by only one test:');
for (const f of fns.filter(f => f.tests.size === 1)) out.push(`  ${String(lineOf(f.start)).padStart(5)}  ${f.name}  — ${[...f.tests][0]}`);
// Uncovered line runs, compressed into ranges
out.push('', 'Unexecuted code line ranges (html line numbers):');
const runs = [];
for (const l of uncoveredLines) { const last = runs[runs.length - 1]; if (last && l - last[1] <= 2) last[1] = l; else runs.push([l, l]); }
out.push('  ' + runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', '));
fs.writeFileSync(path.join(root, 'coverage', 'report.txt'), out.join('\n') + '\n');
console.log(out[0]);
console.log(`Never called: ${never.length} functions. Full report: coverage/report.txt`);
