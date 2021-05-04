const core = require('@actions/core');
const github = require('@actions/github');
const io = require('@actions/io');
const tc = require('@actions/tool-cache');
// const tf_setup = require('setup-terraform/lib/setup-terraform');
const {spawnSync} = require('child_process');

function terraform(params) {
  const options = {
    cwd: core.getInput('terraform_directory')
  }
  const tf = spawnSync('/bin/sh', ['-xc', `${process.env['HOME']}/terraform ${params} 2>&1`], options);
  return {
    stdout: tf.stdout.toString(),
    stderr: tf.stderr.toString(),
    status: tf.status
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
  const tfsInstall = spawnSync('/bin/sh', ['-c', `chmod +x ${tfsPath} && ${tfsPath} -b ${process.env['HOME']}/ 2>&1`]);
  core.info('Installing tfswitch:');
  core.info(tfsInstall.stdout);
  const tfs = spawnSync('/bin/sh', ['-c', `${process.env['HOME']}/tfswitch -b ${process.env['HOME']}/terraform 2>&1`], {cwd: terraformDirectory});
  core.info('Running tfswitch:');
  core.info(tfs.stdout);
  core.endGroup();

  core.startGroup('terraform version');
  const tfv = terraform('version');
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }
  core.info(tfv.stdout);
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
