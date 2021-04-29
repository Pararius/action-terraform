const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  tf_setup();
  const tf = spawnSync('terraform', ['version']);
})().catch(error => {
  core.setFailed(error.message);
});