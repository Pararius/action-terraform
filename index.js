const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );
const { Cipher } = require('crypto');

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  core.startGroup('Setup terraform');
  await tf_setup();
  const tf = spawnSync('terraform', ['version']);
  core.info(`tf ${terraformVersion}: ${tf.stdout.toString()}`);
  core.endGroup();
  core.startGroup('Initialize terraform');
  core.info('Initializing......... done!');
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});