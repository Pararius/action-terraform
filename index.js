const core = require('@actions/core');
const github = require('@actions/github');
const io = require('@actions/io');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const {spawnSync} = require('child_process');

function terraform(params) {
  const options = {
    cwd: core.getInput('terraform_directory')
  }
  const tf = spawnSync('terraform', params, options);
  return {
    stdout: tf.stdout.toString(),
    stderr: tf.stderr.toString(),
    status: tf.status
  }
}

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  const terraformDirectory = core.getInput('terraform_directory');

  core.startGroup('Setup Terraform');
  await tf_setup();
  core.info(`Terraform version: ${terraformVersion}`);
  core.info(`Working directory: ${terraformDirectory}`);
  core.endGroup();

  core.startGroup('terraform version');
  const tfv = terraform(['version']);
  core.info(`status: ${tfv.status}`);
  core.info(tfv.stdout);
  core.info(tfv.stderr);
  core.endGroup();

  core.startGroup('terraform init');
  const tfi = terraform(['init']);
  core.info(`status: ${tfi.status}`);
  core.info(tfi.stdout);
  core.info(tfi.stderr);
  core.endGroup();

  core.startGroup('terraform fmt');
  const tff = terraform(['fmt', '-diff', '-write=false', '-list=false']);
  core.info(`status: ${tff.status}`);
  core.info(tff.stdout);
  core.info(tff.stderr);
  core.endGroup();
  const tffc = terraform(['fmt', '-check']);
  if (tffc.status > 0) {
    core.setFailed('Failed to pass `terraform fmt` checks!');
  }

  core.startGroup('terraform plan');
  const tfp = terraform(['plan', '-out=terraform.plan']);
  core.info(`status: ${tfp.status}`);
  core.info(tfp.stdout);
  core.info(tfp.stderr);
  core.endGroup();
  if (tfp.status > 0) {
    core.setFailed('Failed to run `terraform plan`!');
  }
})().catch(error => {
  core.setFailed(error.message);
});
