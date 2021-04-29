const core = require('@actions/core');
const github = require('@actions/github');
const tf_setup = require('setup-terraform/lib/setup-terraform');

try {
  const terraformVersion = core.getInput('terraform_version');
  await tf_setup();
  
} catch (error) {
  core.setFailed(error.message);
}