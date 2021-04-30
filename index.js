const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );
const { Cipher } = require('crypto');

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  core.startGroup('Setup Terraform');
  await tf_setup();
  const tfv = spawnSync('terraform', ['version']);
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tfv.stdout.toString()}`);
  core.endGroup();
  core.startGroup('terraform init');
  const tfi = spawnSync('terraform', ['init']);
  core.info(tfi.stdout.toString());
  core.endGroup();
  core.startGroup('terraform fmt');
  const tff = spawnSync('terraform', ['fmt', '-diff', '-write=false', '-list=false']);
  core.info(tff.stdout.toString());
  core.endGroup();
  core.startGroup('terraform plan');
  const tfp = spawnSync('terraform', ['plan']);
  core.info(tfp.stdout.toString());
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});