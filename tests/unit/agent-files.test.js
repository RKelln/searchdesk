'use strict';
// The command and skill copies in .opencode, .claude, .pi and .agents must match tools/commands and
// tools/skills (tools/agent-files.py). Skipped when python3 is missing.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { root } = require('./_load');

const has = spawnSync('python3', ['--version']).status === 0;

test('the agent file copies are up to date', { skip: !has && 'python3 is not installed' }, () => {
  const r = spawnSync('python3', ['tools/agent-files.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('each command copy has the same body in every tool folder', { skip: !has && 'python3 is not installed' }, () => {
  const run = spawnSync('python3', ['tools/agent-files.py'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stdout + run.stderr);
  const names = ['check', 'everything', 'kit', 'new-feature', 'screens'];
  const folders = ['.opencode/commands', '.claude/commands', '.pi/prompts'];
  for (const name of names) {
    const bodies = folders.map((f) => {
      const text = require('fs').readFileSync(`${root}/${f}/${name}.md`, 'utf8');
      return text.slice(text.indexOf('\n---\n') + 5);
    });
    for (const body of bodies) assert.strictEqual(body, bodies[0], `${name} differs between tools`);
  }
});