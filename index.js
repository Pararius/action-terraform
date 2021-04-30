const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');
const tf_setup = require('setup-terraform/lib/setup-terraform');
const { Cipher } = require('crypto');

async function terraform() {
  let myOutput = '';
  let myError = '';

  const options = {};
  options.listeners = {
    stdout: (data) => {
      myOutput += data.toString();
    },
    stderr: (data) => {
      myError += data.toString();
    }
  };
  options.cwd = './lib';

  await exec.exec('terraform', ['version'], options);

  retval = new Map();
  retval.set('stdout', myOutput);
  retval.set('stderr', myError);
  return retval;
}

(async () => {
  const terraformVersion = core.getInput('terraform_version');
  const terraformDirectory = core.getInput('terraform_directory');
  core.startGroup('Setup Terraform');
  await tf_setup();
  // const tfv = exec.exec('terraform', ['version']);
  const tfv = await terraform();
  core.info(`Expected Terraform version: ${terraformVersion}`);
  core.info(`Actual Terraform version: ${tfv.stdout}`);
  core.info(`Working directory: ${terraformDirectory}`);
  core.endGroup();
  core.startGroup('terraform init');
  const tfi = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'init']);
  core.info(tfi.stdout);
  core.error(tfi.stderr);
  core.endGroup();
  core.startGroup('terraform fmt');
  const tff = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'fmt', '-diff', '-write=false', '-list=false']);
  core.info(tff.stdout);
  core.error(tff.stderr);
  core.endGroup();
  core.startGroup('terraform plan');
  const tfp = exec.exec('terraform', [`-chdir=${terraformDirectory}`, 'plan']);
  core.info(tfp.stdout);
  core.error(tfp.stderr);
  core.endGroup();
})().catch(error => {
  core.setFailed(error.message);
});