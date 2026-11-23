import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const workflowPath = join(repositoryRoot, '.github/workflows/docs-pages.yml');
let workflow;

test.before(async () => {
  const source = await readFile(workflowPath, 'utf8');
  const document = parseDocument(source, { uniqueKeys: true });
  assert.deepEqual(document.errors, [], 'the Pages workflow must be valid YAML');
  workflow = document.toJS();
});

function jobs() {
  return Object.entries(workflow.jobs);
}

function allSteps() {
  return jobs().flatMap(([jobId, job]) => (job.steps ?? []).map((step) => ({ jobId, job, step })));
}

function findStep(predicate, description) {
  const result = allSteps().find(({ step, job, jobId }) => predicate(step, job, jobId));
  assert.ok(result, `workflow is missing ${description}`);
  return result;
}

function normalized(value) {
  return String(value ?? '').replaceAll(/\s+/g, ' ');
}

function permission(job, key) {
  return job.permissions?.[key] ?? workflow.permissions?.[key] ?? 'none';
}

function environmentName(job) {
  return typeof job.environment === 'string' ? job.environment : job.environment?.name;
}

test('pull requests use the read-only workflow permissions', () => {
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.ok(workflow.on.pull_request, 'the workflow must validate pull requests');
  assert.ok(workflow.on.pull_request.branches.includes('develop'));
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.equal(workflow.on.workflow_run, undefined);

  for (const jobId of ['validate-pull-request', 'build-production']) {
    const job = workflow.jobs[jobId];
    const build = job.steps.find((step) => step.run === 'pnpm docs:site:build');
    assert.equal(build?.env?.BLUE_DOCS_RELEASE_TOKEN, '${{ github.token }}');
    assert.deepEqual(job.permissions, { contents: 'read' });
  }

  const deployId = jobs().find(([, job]) => environmentName(job) === 'github-pages')?.[0];
  for (const [jobId, job] of jobs()) {
    if (jobId === deployId) continue;
    assert.notEqual(permission(job, 'pages'), 'write', `${jobId} must not write Pages`);
    assert.notEqual(
      permission(job, 'id-token'),
      'write',
      `${jobId} must not request an OIDC token`,
    );
  }
});

test('relevant pull requests run strict TypeDoc coverage and upload an inspectable artifact', () => {
  assert.ok(workflow.on.push.paths.includes('scripts/docs-pages-workflow.test.mjs'));
  const pullRequestPaths = workflow.on.pull_request.paths ?? [];
  assert.ok(pullRequestPaths.some((pattern) => /docs\/site|scripts\/.*docs-site/.test(pattern)));
  assert.ok(pullRequestPaths.some((pattern) => /packages\/blue-data/.test(pattern)));
  assert.ok(pullRequestPaths.includes('scripts/docs-pages-workflow.test.mjs'));

  const apiCheck = findStep(
    (step) =>
      typeof step.run === 'string' && step.run.includes('pnpm --filter @blue/data docs:api'),
    'the strict @blue/data docs:api check',
  );
  assert.notEqual(apiCheck.step['continue-on-error'], true);
  assert.notEqual(apiCheck.job['continue-on-error'], true);

  const inspectionArtifact = findStep(
    (step) => step.uses?.startsWith('actions/upload-artifact@'),
    'an inspectable pull-request artifact',
  );
  assert.ok(inspectionArtifact.step.with?.name);
  assert.ok(inspectionArtifact.step.with?.path);
  assert.notEqual(permission(inspectionArtifact.job, 'pages'), 'write');
  assert.notEqual(permission(inspectionArtifact.job, 'id-token'), 'write');
});

test('production uses one non-cancelling group and isolates untrusted dispatches', () => {
  assert.ok(workflow.on.push.branches.includes('develop'));
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.on.workflow_dispatch.inputs.first_deploy.type, 'boolean');
  assert.equal(workflow.on.workflow_dispatch.inputs.first_deploy.required, false);
  assert.equal(workflow.on.workflow_dispatch.inputs.first_deploy.default, false);
  assert.ok(workflow.concurrency, 'the workflow must serialize production runs');
  const group = normalized(workflow.concurrency.group);
  assert.match(group, /production/i);
  assert.match(group, /workflow_dispatch/);
  assert.match(group, /refs\/heads\/develop/);
  assert.match(group, /github\.run_id/);
  assert.match(group, /pull_request/);
  assert.equal(
    workflow.concurrency.queue,
    'max',
    'production runs must not replace an already pending run',
  );

  const cancel = workflow.concurrency['cancel-in-progress'];
  if (cancel !== undefined && cancel !== false) {
    assert.match(
      normalized(cancel),
      /github\.event_name == ['"]pull_request['"]|github\.event_name != ['"]push['"] && github\.event_name != ['"]workflow_dispatch['"]/,
      'only pull-request runs may cancel an in-progress run',
    );
  }
  for (const [jobId, job] of jobs()) {
    assert.equal(
      job.concurrency,
      undefined,
      `${jobId} must share the workflow-level production lock`,
    );
  }
});

test('trusted production checks out current develop and deploys only from the repository', () => {
  const checkout = findStep(
    (step) => step.uses?.startsWith('actions/checkout@') && step.with?.ref === 'refs/heads/develop',
    'a checkout pinned to the current refs/heads/develop branch',
  );
  assert.equal(checkout.job.steps[0], checkout.step, 'production checkout must be the first step');
  assert.notEqual(checkout.step.with.ref, '${{ github.sha }}');

  const deploy = jobs().find(([, job]) => environmentName(job) === 'github-pages');
  assert.ok(deploy, 'the deploy job must use the protected github-pages environment');
  const [deployId, deployJob] = deploy;
  const gate = normalized(deployJob.if);
  assert.match(gate, /github\.repository == ['"]kunstmusik\/blue['"]/);
  assert.match(gate, /github\.ref == ['"]refs\/heads\/develop['"]/);
  assert.match(gate, /github\.event_name == ['"]push['"]/);
  assert.match(gate, /github\.event_name == ['"]workflow_dispatch['"]/);
  assert.doesNotMatch(gate, /pull_request/);
  assert.deepEqual(deployJob.permissions, {
    contents: 'read',
    pages: 'write',
    'id-token': 'write',
  });
  assert.ok(
    (deployJob.steps ?? []).some((step) => step.uses?.startsWith('actions/deploy-pages@')),
    `${deployId} must deploy the Pages artifact`,
  );
  assert.equal(
    (deployJob.steps ?? []).some((step) => step.uses?.startsWith('actions/download-artifact@')),
    false,
    'production must not consume a pull-request inspection artifact',
  );
});

test('production verifies both retained baselines and reserves first deploy for a trusted dispatch', () => {
  const baseline = jobs().find(([, job]) => job.steps?.some((step) => step.id === 'live-baseline'));
  assert.ok(baseline, 'production must resolve the live baseline before building');
  const baselineStep = baseline[1].steps.find((step) => step.id === 'live-baseline');
  assert.equal(baselineStep.env.SITE_URL, 'https://kunstmusik.github.io/blue/');
  assert.match(baselineStep.run, /\?run-id=/);
  assert.match(baselineStep.run, /root_status/);
  assert.match(baselineStep.run, /publication-inventory\.json/);
  assert.match(baselineStep.run, /publication-catalog\.json/);
  assert.match(baselineStep.run, /\$FIRST_DEPLOY"\s*!= 'true'/);
  assert.match(baselineStep.run, /status.*!= '404'/s);
  assert.equal(
    [...baselineStep.run.matchAll(/"\$\{SITE_URL\}\$\{file\}\?run-id=\$\{cache_key\}"/g)].length,
    2,
    'both snapshots must be queried when the home page is either present or absent',
  );

  const verify = findStep(
    (step) => typeof step.run === 'string' && /pnpm docs:site:verify/.test(step.run),
    'documentation artifact verification',
  );
  assert.match(verify.step.run, /--baseline\b/);
  assert.match(verify.step.run, /--baseline-catalog\b/);

  const firstDeploy = findStep(
    (step) => typeof step.run === 'string' && /--first-deploy\b/.test(step.run),
    'an explicit first-deploy verification path',
  );
  const condition = [
    normalized(firstDeploy.job.if),
    normalized(firstDeploy.step.if),
    normalized(firstDeploy.step.run),
  ].join(' ');
  assert.match(condition, /workflow_dispatch/);
  assert.match(condition, /kunstmusik\/blue/);
  assert.match(condition, /refs\/heads\/develop/);
  assert.match(condition, /baseline|live|site/i);
  assert.match(condition, /not-found|missing|first-deploy/i);
  assert.match(condition, /inputs\.first_deploy/);
});

test('build uses the release Quarto and workspace toolchain and smoke-tests the fixed Pages URL', () => {
  const steps = allSteps().map(({ step }) => step);
  assert.ok(
    steps.some(
      (step) =>
        step.uses?.startsWith('actions/setup-node@') &&
        String(step.with?.['node-version']) === '22',
    ),
  );
  assert.ok(
    steps.some(
      (step) =>
        step.uses?.startsWith('pnpm/action-setup@') && String(step.with?.version) === '12.8.1',
    ),
  );
  assert.ok(
    steps.some(
      (step) =>
        step.uses?.startsWith('quarto-dev/quarto-actions/setup@') &&
        String(step.with?.version) === '1.10.18',
    ),
  );
  assert.ok(steps.some((step) => step.run?.includes('pnpm docs:site:build')));
  assert.ok(steps.some((step) => step.run?.includes('pnpm docs:site:smoke')));

  const liveSmoke = findStep(
    (step) =>
      typeof step.run === 'string' &&
      step.env?.SITE_URL === 'https://kunstmusik.github.io/blue/' &&
      step.run.includes('curl') &&
      step.run.includes('home.html'),
    'a cache-busted smoke check of the canonical Pages URL',
  );
  assert.match(liveSmoke.step.run, /curl/);
  assert.match(liveSmoke.step.run, /--fail/);
  assert.match(liveSmoke.step.run, /\?[^\s]*run[_-]?id|\?[^\s]*cache/i);
  assert.match(liveSmoke.step.run, /200/);
});

test('an unprivileged post-deploy check confirms this run is live before releasing its lock', () => {
  const deployId = jobs().find(([, job]) => environmentName(job) === 'github-pages')?.[0];
  assert.ok(deployId, 'the deploy job must exist');
  const smoke = jobs().find(([, job]) => {
    const needs = Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : [];
    return needs.includes(deployId);
  });
  assert.ok(smoke, 'a post-deploy smoke job must wait for Pages deployment');
  const [smokeId, smokeJob] = smoke;
  assert.notEqual(
    permission(smokeJob, 'pages'),
    'write',
    `${smokeId} does not need Pages write access`,
  );
  assert.ok(
    (smokeJob.steps ?? []).some(
      (step) =>
        typeof step.run === 'string' &&
        step.run.includes('home.html') &&
        step.env?.SITE_URL === 'https://kunstmusik.github.io/blue/' &&
        step.run.includes('Blue Documentation'),
    ),
    'the post-deploy smoke must cache-bust the home page and check its expected title',
  );
  assert.notEqual(
    permission(smokeJob, 'id-token'),
    'write',
    `${smokeId} does not need an OIDC token`,
  );
  assert.ok(
    (smokeJob.steps ?? []).some(
      (step) =>
        step.uses?.startsWith('actions/download-artifact@') &&
        String(step.with?.name).includes('github.run_id') &&
        String(step.with?.name).includes('github.run_attempt'),
    ),
    'the smoke must compare against an artifact from this workflow run',
  );
  const liveComparison = (smokeJob.steps ?? []).find(
    (step) =>
      typeof step.run === 'string' &&
      step.run.includes('publication-inventory.json') &&
      step.run.includes('publication-catalog.json') &&
      step.run.includes('cmp'),
  );
  assert.ok(liveComparison, 'the smoke must compare both live snapshot files with this run');
  assert.equal(liveComparison.env.SITE_URL, 'https://kunstmusik.github.io/blue/');
  assert.match(liveComparison.run, /--fail/);
  assert.match(liveComparison.run, /\?[^\s]*run[_-]?id|\?[^\s]*cache/i);
});

test('reruns cannot deploy an artifact verified by a different run attempt', () => {
  const build = workflow.jobs['build-production'];
  assert.match(build.outputs.run_attempt, /steps\.record-attempt\.outputs\.run_attempt/);
  const recordAttempt = build.steps.find((step) => step.id === 'record-attempt');
  assert.match(recordAttempt.run, /GITHUB_RUN_ATTEMPT/);

  const uploaded = build.steps.find((step) =>
    step.uses?.startsWith('actions/upload-pages-artifact@'),
  );
  assert.equal(uploaded.with.name, 'github-pages-${{ github.run_id }}-${{ github.run_attempt }}');

  const deploy = workflow.jobs.deploy;
  const staleGuard = deploy.steps.find(
    (step) => step.name === 'Reject a stale verified build attempt',
  );
  assert.match(
    staleGuard.if,
    /needs\.build-production\.outputs\.run_attempt != github\.run_attempt/,
  );
  assert.match(staleGuard.run, /dispatch a fresh workflow run on develop/i);
  const action = deploy.steps.find((step) => step.uses?.startsWith('actions/deploy-pages@'));
  assert.equal(action.with.artifact_name, uploaded.with.name);
});

test('the Pages workflow does not depend on desktop or npm release workflows', () => {
  assert.equal(workflow.on.workflow_run, undefined);
  for (const [jobId, job] of jobs()) {
    const needs = Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : [];
    assert.equal(
      needs.some((dependency) => /release|desktop|npm/i.test(dependency)),
      false,
      `${jobId} must not depend on a desktop or npm release job`,
    );
  }
});
