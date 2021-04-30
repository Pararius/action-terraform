const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );
const { Cipher } = require('crypto');

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  core.startGroup('Install terraform');
  await tf_setup();
  const tfv = spawnSync('terraform', ['version']);
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tfv.stdout.toString()}`);
  core.endGroup();
  core.startGroup('Initialize terraform');
  const tfi = spawnSync('terraform', ['init']);
  core.info(tfi.stdout.toString());
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});