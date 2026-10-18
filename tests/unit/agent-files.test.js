'use strict';
// The command and skill copies in .opencode, .claude, .pi and .agents must match tools/commands and
// tools/skills (tools/agent-files.py). Skipped when python3 is missing, and when this copy has no tools/ to
// check against -- see `gone` in _load.js.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { root, gone, noRepo } = require('./_load');

const noPy = spawnSync('python3', ['--version']).status !== 0;
const noTool = gone('tools/agent-files.py');
const why = noPy ? 'python3 is not installed' : noTool;

test('the agent file copies are up to date', { skip: why }, () => {
  const r = spawnSync('python3', ['tools/agent-files.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('each command copy has the same body in every tool folder', { skip: why }, () => {
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

// --check only looks at the files on disk, so a copy that was never committed still passes it: a .gitignore
// pattern with no leading slash will happily swallow a whole folder. This asks git instead, which needs both
// git and a repository to ask: a copy taken from an archive has the files and no .git to check them against.
const noGit = spawnSync('git', ['--version'], { cwd: root }).status !== 0;

test('every copy is in git, not only on disk', { skip: noPy ? 'python3 is not installed' : noTool || (noGit ? 'git is not installed' : noRepo()) }, () => {
  const listed = spawnSync('python3', ['tools/agent-files.py', '--paths'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(listed.status, 0, listed.stdout + listed.stderr);
  const paths = listed.stdout.trim().split('\n');
  assert.ok(paths.length > 10, 'the tool found nothing to write');
  const tracked = new Set(spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).stdout.split('\n'));
  for (const p of paths) {
    assert.ok(tracked.has(p), p + ' is not in git: a .gitignore pattern is probably hiding it');
  }
});