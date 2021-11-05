const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const fs = require('fs');

const status_skipped = '﹣';
const status_success = '✓'
const status_failed = '✕';

const terraformPath = `${process.env['HOME']}/terraform`;

async function shell(command, args, options = {}) {
  options.env = {
    ...process.env,
    ...options.env,
    GOOGLE_APPLICATION_CREDENTIALS: `${process.env['HOME']}/gcloud.json`,
  }
  options.listeners = {
    ...options.listeners,
    debug: (data) => { core.debug(data.toString()) }
  }

  const result = await exec.getExecOutput(command, args, options);
  return {
    status: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

async function terraform(args) {
  return await shell(terraformPath, args, {
    cwd: core.getInput('terraform_directory'),
  });
}

(async () => {
  const terraformDirectory = core.getInput('terraform_directory');
  let terraformDoApply = core.getInput('terraform_do_apply');
  const terraformLock = core.getInput('terraform_lock');
  const terraformParallelism = core.getInput('terraform_parallelism');

  let tf_version = '<unknown>';
  let tf_init = status_skipped;
  let tf_fmt = status_skipped;
  let tf_plan = status_skipped;
  let tf_apply = status_skipped;

  core.startGroup('Sanity checking inputs');
  if (terraformLock !== 'true' && terraformLock !== 'false') {
    core.setFailed(`Sanity checks failed. Unknown value for 'terraform_lock': ${terraformLock}`);
    process.exit(1);
  }
  if (/^\d+$/.test(terraformParallelism) === false) {
    core.setFailed(`Sanity checks failed. Non-integer value for 'terraform_parallelism': ${terraformParallelism}`);
    process.exit(1);
  }
  core.info('Good to go!');
  core.endGroup();

  core.startGroup('Configure Google Cloud credentials');
  fs.writeFileSync(`${process.env['HOME']}/gcloud.json`, core.getInput('google_credentials'))
  core.endGroup();

  core.startGroup('Setup Terraform CLI');
  core.info(`Working directory: ${terraformDirectory}`);
  core.info('Installing tfswitch:');
  const tfsPath = await tc.downloadTool('https://raw.githubusercontent.com/warrensbox/terraform-switcher/release/install.sh');
  await shell('chmod', ['+x', tfsPath]);
  await shell(tfsPath, ['-b', `${process.env['HOME']}/`]);
  core.info('Running tfswitch:');
  const tfs = await shell(`${process.env['HOME']}/tfswitch`, ['-b', terraformPath], {
    cwd: terraformDirectory,
  });
  core.endGroup();
  if (tfs.status > 0) {
    core.setFailed(`Failed to determine which terraform version to use [err:${tfs.status}]`);
    process.exit(1);
  }

  core.startGroup('Run terraform version');
  const tfv = await terraform(['version']);
  core.endGroup();
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
    core.setFailed(`Failed to determine terraform version [err:${tfv.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }

  core.startGroup('Run terraform init');
  const tfi = await terraform(['init']);
  core.endGroup();
  if (tfi.status > 0) {
    tf_init = status_failed;
    core.setFailed(`Failed to initialize terraform [err:${tfi.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_init = status_success;
  }

  core.startGroup('Run terraform fmt');
  const tffc = await terraform(['fmt', '-check']);
  if (tffc.status > 0) {
    await terraform(['fmt', '-diff', '-write=false', '-list=false']);
  }
  core.endGroup();
  if (tffc.status > 0) {
    tf_fmt = status_failed;
    core.setFailed(`Failed to pass terraform formatting checks [err:${tffc.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_fmt = status_success;
  }

  core.startGroup('Run terraform plan');
  const tfp = await terraform(['plan', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-out=terraform.plan']);
  core.endGroup();
  if (tfp.status > 0) {
    tf_plan = status_failed;
    core.setFailed(`Failed to prepare the terraform plan [err:${tfp.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_plan = status_success;
  }

  core.startGroup('Run terraform apply');
  if (terraformDoApply === 'true') {
    const tfa = await terraform(['apply', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-auto-approve', 'terraform.plan']);
    core.endGroup();
    if (tfa.status > 0) {
      tf_apply = status_failed;
      core.setFailed(`Failed to apply terraform plan [err:${tfa.status}]`);
    } else {
      tf_apply = status_success;
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }
  core.info('');
  core.info(`Version: ${tf_version}`);
  core.info(`Initialization: ${tf_init}`)
  core.info(`Formatting: ${tf_fmt}`)
  core.info(`Plan: ${tf_plan}`)
  core.info(`Apply: ${tf_apply}`)
})().catch(error => {
  core.setFailed(error.message);
});
