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
  return spawnSync('terraform', params, options);
}

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  const terraformDirectory = core.getInput('terraform_directory');
  core.startGroup('Setup Terraform');
  await tf_setup();
  const tfv = terraform(['version']);
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tfv.stdout.toString()}`);
  core.info(`Working directory: ${terraformDirectory}`);
  core.endGroup();
  core.startGroup('terraform init');
  const tfi = terraform(['init']);
  core.info(tfi.stdout.toString());
  core.info(tfi.stderr.toString());
  tfi
  core.endGroup();
  core.startGroup('terraform fmt');
  const tff = terraform(['fmt', '-diff', '-write=false', '-list=false']);
  core.info(tff.stdout.toString());
  core.info(tff.stderr.toString());
  core.endGroup();
  core.startGroup('terraform plan');
  const tfp = terraform(['plan']);
  core.info(tfp.stdout.toString());
  core.info(tfp.stderr.toString());
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});