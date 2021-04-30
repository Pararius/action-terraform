const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { Cipher } = require('crypto');

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  const terraformDirectory = core.getInput('terraform_directory');
  core.startGroup('Setup Terraform');
  await tf_setup();
  const tfv = exec.exec('terraform', ['version']);
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tfv.stdout.toString()}`);
  core.info(`Working directory: ${terraformDirectory}`);
  core.endGroup();
  core.startGroup('terraform init');
  const tfi = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'init']);
  core.info(tfi.stdout.toString());
  core.error(tfi.stderr.toString());
  core.endGroup();
  core.startGroup('terraform fmt');
  const tff = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'fmt', '-diff', '-write=false', '-list=false']);
  core.info(tff.stdout.toString());
  core.error(tff.stderr.toString());
  core.endGroup();
  core.startGroup('terraform plan');
  const tfp = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'plan']);
  core.info(tfp.stdout.toString());
  core.error(tfp.stderr.toString());
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});