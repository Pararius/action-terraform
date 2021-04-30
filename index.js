const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );
const { Cipher } = require('crypto');

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  core.startGroup('Install terraform');
  await tf_setup();
  const tf = spawnSync('terraform', ['version']);
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tf.stdout.toString()}`);
  core.endGroup();
  core.startGroup('Initialize terraform');
  const tf = spawnSync('terraform', ['init']);
  core.info(tf.stdout.toString());
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});