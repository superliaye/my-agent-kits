## Source-tree fingerprint

Run this exact read-only command from anywhere inside the repository. Use its sole stdout line,
`sha256:<hex>`, as the fingerprint; do not reimplement it in another language or shell pipeline.

```sh
node <<'NODE'
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const maxBuffer = 1024 * 1024 * 1024;
const git = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'buffer',
  maxBuffer,
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
const repositoryRoot = (cwd) => stripLineEnding(git(cwd, ['rev-parse', '--show-toplevel']))
  .toString('utf8');
const nestedRepositoryRoot = (absolutePath) => {
  const decoded = absolutePath.toString('utf8');
  if (!Buffer.from(decoded).equals(absolutePath)) {
    throw new Error(`Cannot enter a non-UTF-8 directory path: ${absolutePath.toString('hex')}`);
  }
  try {
    const candidate = repositoryRoot(decoded);
    return fs.realpathSync(candidate) === fs.realpathSync(decoded) ? candidate : null;
  } catch {
    return null;
  }
};

const fingerprintRepository = (root) => {
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
  field('INDEX', git(root, ['ls-files', '--stage', '-z']));

  const entries = new Map();
  for (const relativePath of splitNul(git(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']))) {
    entries.set(relativePath.toString('base64'), { relativePath, scope: 'tracked' });
  }
  for (const relativePath of splitNul(git(root, ['ls-files', '--cached', '-z']))) {
    entries.set(relativePath.toString('base64'), { relativePath, scope: 'tracked' });
  }
  for (const relativePath of splitNul(
    git(root, ['ls-files', '--others', '--exclude-standard', '-z']),
  )) {
    const key = relativePath.toString('base64');
    if (!entries.has(key)) entries.set(key, { relativePath, scope: 'untracked' });
  }

  const sortedEntries = [...entries.values()]
    .sort((left, right) => Buffer.compare(left.relativePath, right.relativePath));
  for (const entry of sortedEntries) {
    const absolutePath = Buffer.concat([Buffer.from(root + path.sep), entry.relativePath]);
    let stat;
    try {
      stat = fs.lstatSync(absolutePath, { bigint: true });
    } catch (error) {
      if (entry.scope !== 'tracked' || error.code !== 'ENOENT') throw error;
    }

    let type = 'deleted';
    let mode = 'none';
    let content = Buffer.alloc(0);
    if (stat) {
      mode = stat.mode.toString(8);
      if (stat.isFile()) {
        type = 'file';
        content = fs.readFileSync(absolutePath);
      } else if (stat.isSymbolicLink()) {
        type = 'symlink';
        content = fs.readlinkSync(absolutePath, { encoding: 'buffer' });
      } else if (stat.isDirectory()) {
        type = 'directory';
        const nestedRoot = nestedRepositoryRoot(absolutePath);
        if (nestedRoot) content = fingerprintRepository(nestedRoot);
      } else {
        throw new Error(`Unsupported source entry type: ${entry.relativePath.toString('hex')}`);
      }
    }

    field('ENTRY_SCOPE', Buffer.from(entry.scope, 'ascii'));
    field('ENTRY_PATH', entry.relativePath);
    field('ENTRY_TYPE', Buffer.from(type, 'ascii'));
    field('ENTRY_MODE', Buffer.from(mode, 'ascii'));
    field('ENTRY_CONTENT', content);
  }

  return hash.digest();
};

const root = repositoryRoot(process.cwd());
process.stdout.write(`sha256:${fingerprintRepository(root).toString('hex')}\n`);
NODE
```

The command hashes the HEAD object, raw staged index, and actual type, mode, and bytes of every path
in the HEAD-tree, index, and non-ignored-untracked union. This includes staged and unstaged deletions
and nested Git worktrees. Symlinks contribute their link-target bytes. It fails rather than omitting
an unreadable or unsupported entry. Ignored files and Git metadata are outside the fingerprint. Do
not write, stage, refresh the index, or run a formatter while measuring it.
