## Git-visible source-state attestation

Run this exact read-only command from anywhere inside the repository. Use its sole stdout line,
`sha256:<hex>`, as the attestation. It hashes the checked-out `HEAD`, the tracked worktree diff, and
the path, type, mode, and bytes of non-ignored untracked entries. Unchanged tracked files and state
that the outer repository does not report are outside this acceptance boundary.

```sh
node <<'NODE'
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const git = (cwd, args) => execFileSync('git', args, {
  cwd,
  encoding: 'buffer',
  maxBuffer: 1024 * 1024 * 1024,
});
const stripLineEnding = (value) => {
  let end = value.length;
  if (end > 0 && value[end - 1] === 0x0a) end -= 1;
  if (end > 0 && value[end - 1] === 0x0d) end -= 1;
  return value.subarray(0, end);
};
const splitNul = (value) => {
  const parts = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== 0) continue;
    parts.push(value.subarray(start, index));
    start = index + 1;
  }
  if (start !== value.length) throw new Error('Git emitted a non-NUL-terminated path list');
  return parts;
};

const rootBytes = stripLineEnding(git(process.cwd(), ['rev-parse', '--show-toplevel']));
const root = rootBytes.toString('utf8');
if (!Buffer.from(root).equals(rootBytes)) throw new Error('Repository path is not valid UTF-8');

const hash = crypto.createHash('sha256');
const frame = (value) => {
  const size = Buffer.alloc(8);
  size.writeBigUInt64BE(BigInt(value.length));
  hash.update(size);
  hash.update(value);
};
const field = (name, value) => {
  frame(Buffer.from(name, 'ascii'));
  frame(value);
};

field('HEAD', stripLineEnding(git(root, ['rev-parse', '--verify', 'HEAD'])));
field('TRACKED_WORKTREE', git(root, [
  'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', '--no-renames', 'HEAD', '--',
]));

const untracked = splitNul(git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
  .sort(Buffer.compare);
for (const relativePath of untracked) {
  const absolutePath = Buffer.concat([Buffer.from(root + path.sep), relativePath]);
  const stat = fs.lstatSync(absolutePath);
  let type;
  let mode;
  let content = Buffer.alloc(0);
  if (stat.isFile()) {
    type = 'file';
    mode = (stat.mode & 0o111) === 0 ? '100644' : '100755';
    content = fs.readFileSync(absolutePath);
  } else if (stat.isSymbolicLink()) {
    type = 'symlink';
    mode = '120000';
    content = fs.readlinkSync(absolutePath, { encoding: 'buffer' });
  } else if (stat.isDirectory()) {
    type = 'directory';
    mode = '040000';
  } else {
    throw new Error(`Unsupported untracked entry type: ${relativePath.toString('hex')}`);
  }

  field('ENTRY_PATH', relativePath);
  field('ENTRY_TYPE', Buffer.from(type, 'ascii'));
  field('ENTRY_MODE', Buffer.from(mode, 'ascii'));
  field('ENTRY_CONTENT', content);
}

process.stdout.write(`sha256:${hash.digest('hex')}\n`);
NODE
```

The command fails rather than omitting an unreadable or unsupported reported entry. It does not
write, stage, refresh the index, or inspect ignored files or Git metadata.
