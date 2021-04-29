const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform#v1/lib');

try {
  const terraformVersion = core.getInput('terraform_version');
  tf_setup.run();
  
} catch (error) {
  core.setFailed(error.message);
}