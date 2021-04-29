const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { spawnSync } = require( 'child_process' );

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

try {
  const terraformVersion = core.getInput('terraform_version');
  tf_setup();

  const tf = spawnSync('terraform', ['version']);
  sleep(2000).then(() => {
    core.info(`tf1 ${terraformVersion}: ${tf.stdout.toString()}`);
  });
core.info(`tf2 ${terraformVersion}: ${tf.stdout.toString()}`);
} catch (error) {
  core.setFailed(error.message);
}