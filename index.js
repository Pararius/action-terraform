const core = require('@actions/core');
const github = require('@actions/github');
const io = require('@actions/io');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );
const { Cipher } = require('crypto');

function terraform(params) {
  const options = {
    cwd: core.getInput('terraform_directory')
  }
  const process = spawnSync('terraform', params, options);
  return {
    stdout: process.stdout.toString(),
    stderr: process.stderr.toString(),
    status: process.status
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
  core.info(tfv.stdout);
  core.info(tfv.stderr);
  tfi
  core.endGroup();
  const tfi = terraform(['init']);
  core.info(tfi.stdout);
  core.info(tfi.stderr);
  tfi
  core.endGroup();
  core.startGroup('terraform fmt');
  const tff = terraform(['fmt', '-diff', '-write=false', '-list=false']);
  core.info(tff.stdout);
  core.info(tff.stderr);
  core.endGroup();
  core.startGroup('terraform plan');
  const tfp = terraform(['plan']);
  core.info(tfp.stdout);
  core.info(tfp.stderr);
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});