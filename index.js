const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  await tf_setup();
  const tf = spawnSync('terraform', ['version']);
  core.info(`tf ${terraformVersion}: ${tf.stdout.toString()}`);
})().catch(error => {
  core.setFailed(error.message);
});