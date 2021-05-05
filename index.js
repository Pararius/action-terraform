const core = require('@actions/core');
const github = require('@actions/github');
const tc = require('@actions/tool-cache');
const {spawnSync} = require('child_process');
const { Cipher } = require('crypto');
const { exit } = require('process');

function shell(command, options) {
  const sh = spawnSync('/bin/sh', ['-c', `${command} 2>&1`], {
    ...{env: {
      ...process.env,
      ...{'GOOGLE_APPLICATION_CREDENTIALS': `${process.env['HOME']}/gcloud.json`}
    },
    ...options
  }});
  return {
    status: sh.status,
    stderr: sh.stderr.toString(),
    stdout: sh.stdout.toString()
  }
}

function terraform(params) {
  const tf = shell(`${process.env['HOME']}/terraform ${params}`, {
    cwd: core.getInput('terraform_directory')
  });
  return {
    status: tf.status,
    stderr: tf.stderr,
    stdout: tf.stdout
  }
}

(async () => {
  const terraformDirectory = core.getInput('terraform_directory');
  let terraformDoApply = core.getInput('terraform_do_apply');

  let tf_version = '<unknown>';
  let tf_init = `\ufe63`;
  let tf_fmt = `\ufe63`;
  let tf_plan = `\ufe63`;
  let tf_apply = `\ufe63`;

  core.startGroup('Configure Google Cloud credentials');
  shell(`printf '%s' '${core.getInput('google_credentials')}' > $GOOGLE_APPLICATION_CREDENTIALS`);
  core.endGroup();

  core.startGroup('Setup Terraform CLI');
  core.info(`Working directory: ${terraformDirectory}`);
  const tfsPath = await tc.downloadTool('https://raw.githubusercontent.com/warrensbox/terraform-switcher/release/install.sh');
  const tfsInstall = shell(`chmod +x ${tfsPath} && ${tfsPath} -b ${process.env['HOME']}/`);
  core.info('Installing tfswitch:');
  core.info(tfsInstall.stdout);
  core.info(tfsInstall.stderr);
  const tfs = shell(`${process.env['HOME']}/tfswitch -b ${process.env['HOME']}/terraform`, {
    cwd: terraformDirectory
  });
  core.info('Running tfswitch:');
  core.info(tfs.stdout);
  core.info(tfs.stderr);
  core.endGroup();
  if (tfs.status > 0) {
    core.setFailed(`Failed to determine which terraform version to use [err:${tfs.status}]`);
    process.exit(1);
  }

  core.startGroup('Run terraform version');
  const tfv = terraform('version');
  core.info(tfv.stdout);
  core.info(tfv.stderr);
  core.endGroup();
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
    core.setFailed(`Failed to determine terraform version [err:${tfv.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }

  core.startGroup('Run terraform init');
  const tfi = terraform('init');
  core.info(tfi.stdout);
  core.endGroup();
  if (tfi.status > 0) {
    tf_init = `\u2715`;
    core.setFailed(`Failed to initialize terraform [err:${tfi.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_init = `\u2713`;
  }

  core.startGroup('Run terraform fmt');
  const tffc = terraform('fmt -check');
  if (tffc.status > 0) {
    const tff = terraform('fmt -diff -write=false -list=false');
    core.info(tff.stdout);
  }
  core.endGroup();
  if (tffc.status > 0) {
    tf_fmt = `\u2715`;
    core.setFailed(`Failed to pass terraform formatting checks [err:${tffc.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_fmt = `\u2713`;
  }

  core.startGroup('Run terraform plan');
  const tfp = terraform('plan -out=terraform.plan');
  core.info(tfp.stdout);
  core.endGroup();
  if (tfp.status > 0) {
    tf_plan = `\u2715`;
    core.setFailed(`Failed to prepare the terraform plan [err:${tfp.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_plan = `\u2713`;
  }

  core.startGroup('Run terraform apply');
  if (terraformDoApply === 'true') {
    const tfa = terraform('apply -auto-approve terraform.plan');
    core.info(tfa.stdout);
    core.endGroup();
    if (tfa.status > 0) {
      tf_apply = `\u2715`;
      core.setFailed(`Failed to apply terraform plan [err:${tfa.status}]`);
    } else {
      tf_apply = `\u2713`;
    }
  } else {
    core.info('Skipped');
    const c = shell(`curl -s -X POST --data-urlencode "payload={\\\"channel\\\":\\\"#terraform\\\", \\\"username\\\":\\\"terraform\\\", \\\"text\\\":\\\"Failed to apply terraform plan in ${process.env['GITHUB_REPOSITORY']}. See: <${core.getInput('github_pr_url')}|${core.getInput('github_pr_title')}>  (<${core.getInput('github_run_url')}|Logs>).\\\"}" ${core.getInput('slack_url')}`);
    core.info(c.stdout);
    core.info(c.stderr);
    core.info(`curl -s -X POST --data-urlencode "payload={\\\"channel\\\":\\\"#terraform\\\", \\\"username\\\":\\\"terraform\\\", \\\"text\\\":\\\"Failed to apply terraform plan in ${process.env['GITHUB_REPOSITORY']}. See: <${core.getInput('github_pr_url')}|${core.getInput('github_pr_title')}>  (<${core.getInput('github_run_url')}|Logs>).\\\"}" ${core.getInput('slack_url')}`);
    core.endGroup();
  }
  core.info(shell(`curl -H "Accept: application/vnd.github.v3+json" ${process.env['GITHUB_API_URL']}/${process.env['GITHUB_REPOSITORY']}/actions/runs/${process.env['GITHUB_RUN_ID']}`).stdout);
  core.info('');
  core.info(`Version: ${tf_version}`);
  core.info(`Initialization: ${tf_init}`)
  core.info(`Formatting: ${tf_fmt}`)
  core.info(`Plan: ${tf_plan}`)
  core.info(`Apply: ${tf_apply}`)
})().catch(error => {
  core.setFailed(error.message);
});
