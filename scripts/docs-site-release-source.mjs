import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const PUBLIC_REPOSITORY = 'https://github.com/kunstmusik/blue';

export async function assertPublishedTag({ tag, sourceSha }, checkout) {
  const ref = `refs/tags/${tag}`;
  const peeled = `${ref}^{}`;
  const { stdout: local } = await exec('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: checkout,
  });
  if (local.trim() !== sourceSha)
    throw new Error(`Local tag ${tag} does not identify ${sourceSha}`);

  const { stdout: remote } = await exec(
    'git',
    ['ls-remote', `${PUBLIC_REPOSITORY}.git`, ref, peeled],
    { cwd: checkout, timeout: 30_000 },
  );
  const refs = new Map(
    remote
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, name] = line.split('\t');
        return [name, sha];
      }),
  );
  if ((refs.get(peeled) ?? refs.get(ref)) !== sourceSha) {
    throw new Error(`Published tag ${tag} does not identify ${sourceSha}`);
  }
}
