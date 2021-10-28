const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const {spawnSync} = require('child_process');

const status_skipped = '﹣';
const status_success = '✓'
const status_failed = '✕';

function shell(command, options) {
  const sh = spawnSync('/bin/sh', ['-c', `${command} 2>&1`], {
    ...{env: {
      ...process.env,
      ...{'GOOGLE_APPLICATION_CREDENTIALS': `${process.env['HOME']}/gcloud.json`}
    },
    ...options
  }});
  return {
    status: sh.status,
    stderr: sh.stderr.toString(),
    stdout: sh.stdout.toString()
  }
}

function terraform(params) {
  const tf = shell(`${process.env['HOME']}/terraform ${params}`, {
    cwd: core.getInput('terraform_directory')
  });
  return {
    status: tf.status,
    stderr: tf.stderr,
    stdout: tf.stdout
  }
}

(async () => {
  const terraformDirectory = core.getInput('terraform_directory');
  let terraformDoApply = core.getInput('terraform_do_apply');
  const terraformDoDestroy = core.getInput('terraform_do_destroy');
  const terraformLock = core.getInput('terraform_lock');
  const terraformParallelism = core.getInput('terraform_parallelism');
  const terraformWorkspace = core.getInput('terraform_workspace');

  let tf_version = '<unknown>';
  let tf_workspace_selection = status_skipped;
  let tf_workspace_creation = status_skipped;
  let tf_init = status_skipped;
  let tf_fmt = status_skipped;
  let tf_plan = status_skipped;
  let tf_apply = status_skipped;
  let tf_destroy = status_skipped;
  let tf_workspace_deletion = status_skipped;

  core.startGroup('Sanity checking inputs');
  if (terraformLock !== 'true' && terraformLock !== 'false') {
    core.setFailed(`Sanity checks failed. Unknown value for 'terraform_lock': ${terraformLock}`);
    process.exit(1);
  }
  if (/^\d+$/.test(terraformParallelism) === false) {
    core.setFailed(`Sanity checks failed. Non-integer value for 'terraform_parallelism': ${terraformParallelism}`);
    process.exit(1);
  }
  if (terraformDoApply === 'true' && terraformDoDestroy === 'true') {
    core.setFailed(`Sanity checks failed. Can't apply AND destroy in the same action`);
    process.exit(1);
  }
  core.info('Good to go!');
  core.endGroup();

  core.startGroup('Configure Google Cloud credentials');
  shell(`printf '%s' '${core.getInput('google_credentials')}' > $GOOGLE_APPLICATION_CREDENTIALS`);
  core.endGroup();

  core.startGroup('Setup Terraform CLI');
  core.info(`Working directory: ${terraformDirectory}`);
  core.info('Installing tfswitch:');
  const tfsPath = await tc.downloadTool('https://raw.githubusercontent.com/warrensbox/terraform-switcher/release/install.sh');
  const tfsInstall = shell(`chmod +x ${tfsPath} && ${tfsPath} -b ${process.env['HOME']}/`);
  core.info(tfsInstall.stdout);
  core.info(tfsInstall.stderr);
  core.info('Running tfswitch:');
  const tfs = shell(`${process.env['HOME']}/tfswitch -b ${process.env['HOME']}/terraform`, {
    cwd: terraformDirectory
  });
  core.info(tfs.stdout);
  core.info(tfs.stderr);
  core.endGroup();
  if (tfs.status > 0) {
    core.setFailed(`Failed to determine which terraform version to use [err:${tfs.status}]`);
    process.exit(1);
  }

  core.startGroup('Run terraform version');
  const tfv = terraform('version');
  core.info(tfv.stdout);
  core.info(tfv.stderr);
  core.endGroup();
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
    core.setFailed(`Failed to determine terraform version [err:${tfv.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }

  if (terraformWorkspace) {
    core.startGroup('Run terraform workspace selection');
    const tfws = terraform(`workspace select ${terraformWorkspace}`);
    core.info(tfws.stdout);
    core.endGroup();
    if (tfws.status > 0) {
      tf_workspace_selection = status_failed;

      core.startGroup('Run terraform workspace creation');
      const tfwn = terraform(`workspace new ${terraformWorkspace}`);
      core.info(tfwn.stdout);
      core.endGroup();

      if (tfwn.status > 0) {
        tf_workspace_creation = status_failed
        core.setFailed(`Failed to initialize workspace`);

        terraformDoApply = 'false';
      } else {
        tf_workspace_creation = status_success
      }
    } else {
      tf_workspace_selection = status_success;
    }
  }

  core.startGroup('Run terraform init');
  const tfi = terraform('init');
  core.info(tfi.stdout);
  core.endGroup();
  if (tfi.status > 0) {
    tf_init = status_failed;
    core.setFailed(`Failed to initialize terraform [err:${tfi.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_init = status_success;
  }

  core.startGroup('Run terraform fmt');
  const tffc = terraform('fmt -check');
  if (tffc.status > 0) {
    const tff = terraform('fmt -diff -write=false -list=false');
    core.info(tff.stdout);
  }
  core.endGroup();
  if (tffc.status > 0) {
    tf_fmt = status_failed;
    core.setFailed(`Failed to pass terraform formatting checks [err:${tffc.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_fmt = status_success;
  }

  core.startGroup('Run terraform plan');
  const tfp = terraform(`plan -out=terraform.plan -lock=${terraformLock} -parallelism=${terraformParallelism}`);
  core.info(tfp.stdout);
  core.endGroup();
  if (tfp.status > 0) {
    tf_plan = status_failed;
    core.setFailed(`Failed to prepare the terraform plan [err:${tfp.status}]`);
    terraformDoApply = 'false';
  } else {
    tf_plan = status_success;
  }

  core.startGroup('Run terraform apply');
  if (terraformDoApply === 'true') {
    const tfa = terraform(`apply -auto-approve terraform.plan -lock=${terraformLock} -parallelism=${terraformParallelism}`);
    core.info(tfa.stdout);
    core.endGroup();
    if (tfa.status > 0) {
      tf_apply = status_failed;
      core.setFailed(`Failed to apply terraform plan [err:${tfa.status}]`);
    } else {
      tf_apply = status_success;
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }

  core.startGroup('Run terraform destroy');
  if (terraformDoDestroy === 'true') {
    const tfd = terraform(`destroy -auto-approve -lock=${terraformLock} -parallelism=${terraformParallelism}`);
    core.info(tfd.stdout);
    core.endGroup();
    if (tfd.status > 0) {
      tf_destroy = status_failed;
      core.setFailed(`Failed to destroy resources [err:${tfd.status}]`);
    } else {
      tf_destroy = status_success;

      if (terraformWorkspace) {
        core.startGroup('Run terraform workspace deletion');
        terraform(`workspace select default`); // have to switch to different workspace before deleting workspace defined in `terraformWorkspace`
        const tfwr = terraform(`workspace delete ${terraformWorkspace}`);
        core.info(tfwr.stdout);
        core.endGroup();
        if (tfwr.status > 0) {
          tf_workspace_deletion = status_failed;
          core.setFailed(`Failed to delete terraform workspace [err:${tfwr.status}]`);
        } else {
          tf_workspace_deletion = status_success;
        }
      }
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }

  core.info('');
  core.info(`Version: ${tf_version}`);
  core.info(`Workspace creation: ${tf_workspace_creation}`)
  core.info(`Workspace selection: ${tf_workspace_selection}`)
  core.info(`Initialization: ${tf_init}`)
  core.info(`Formatting: ${tf_fmt}`)
  core.info(`Plan: ${tf_plan}`)
  core.info(`Apply: ${tf_apply}`)
  core.info(`Destroy: ${tf_destroy}`)
  core.info(`Workspace deletion: ${tf_workspace_deletion}`)
})().catch(error => {
  core.setFailed(error.message);
});
