const core = require('@actions/core');
const github = require('@actions/github');
const io = require('@actions/io');
const tc = require('@actions/tool-cache');
const {spawnSync} = require('child_process');
const { exit } = require('process');

function shell(command, options) {
  const sh = spawnSync('/bin/sh', ['-c', `${command} 2>&1`], options);
  // core.warning(`sh.status: ${sh.status}`);
  // core.warning(`sh.stderr: ${sh.stderr}`);
  // core.warning(`sh.stdout: ${sh.stdout}`);
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
  const terraformDoApply = core.getInput('terraform_do_apply');

  let tf_version = '<unknown>';
  let tf_init = `\ufe63`;
  let tf_fmt = `\ufe63`;
  let tf_plan = `\ufe63`;
  let tf_apply = `\ufe63`;

  core.startGroup('Setup Terraform');
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
    core.setFailed('Failed to determine which terraform version to use');
    process.exit(1);
  }

  core.startGroup('terraform version');
  const tfv = terraform('version');
  core.info(tfv.stdout);
  core.info(tfv.stderr);
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }
  core.endGroup();

  core.startGroup('terraform init');
  const tfi = terraform('init');
  if (tfi.status > 0) {
    core.info(`status: ${tfi.status}`);
    tf_init = `\u2715`;
  } else {
    tf_init = `\u2713`;
  }
  core.info(tfi.stdout);
  core.endGroup();

  core.startGroup('terraform fmt');
  const tffc = terraform('fmt -check');
  if (tffc.status > 0) {
    core.info(`status: ${tffc.status}`);
    tf_fmt = `\u2715`;
    const tff = terraform('fmt -diff -write=false -list=false');
    core.info(tff.stdout);
  } else {
    tf_fmt = `\u2713`;
  }
  core.endGroup();

  core.startGroup('terraform plan');
  const tfp = terraform('plan -out=terraform.plan');
  if (tfp.status > 0) {
    core.info(`status: ${tfp.status}`);
    tf_plan = `\u2715`;
  } else {
    tf_plan = `\u2713`;
  }
  core.info(tfp.stdout);
  core.endGroup();

  core.startGroup('terraform apply');
  if (terraformDoApply === 'true') {
    const tfa = terraform('apply -auto-approve terraform.plan');
    if (tfa.status > 0) {
      core.info(`status: ${tfa.status}`);
      tf_apply = `\u2715`;
    } else {
      tf_apply = `\u2713`;
    }
    core.info(tfa.stdout);
  } else {
    core.info('Skipped');
  }
  core.endGroup();

  core.info('');
  core.info(`Version: ${tf_version}`);
  core.info(`Initialization: ${tf_init}`)
  core.info(`Formatting: ${tf_fmt}`)
  core.info(`Plan: ${tf_plan}`)
  core.info(`Apply: ${tf_apply}`)
})().catch(error => {
  core.setFailed(error.message);
});
