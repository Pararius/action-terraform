const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const { WebClient } = require('@slack/web-api');

const status_skipped = '﹣';
const status_success = '✓';
const status_failed = '✕';

const terraformPath = 'terraform';

async function shell(command, args, options = {}) {
  options.env = {
    ...process.env,
    ...options.env,
    GOOGLE_APPLICATION_CREDENTIALS: `${process.env['HOME']}/gcloud.json`,
  };
  options.listeners = {
    ...options.listeners,
    debug: (data) => { core.debug(data.toString()); },
  };
  options.ignoreReturnCode ??= true;

  const result = await exec.getExecOutput(command, args, options);
  return {
    status: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

async function terraform(terraformDirectory, args) {
  return await shell(terraformPath, args, {
    cwd: terraformDirectory,
  });
}

(async () => {
  const terraformBackend = core.getInput('terraform_backend'); 
  let terraformDoApply = core.getBooleanInput('terraform_do_apply');
  let terraformDoDestroy = core.getBooleanInput('terraform_do_destroy');
  const terraformDirectory = core.getInput('terraform_directory');
  const terraformLock = core.getBooleanInput('terraform_lock');
  const terraformParallelism = core.getInput('terraform_parallelism');
  const terraformPlanDestroy = (terraformDoDestroy || core.getBooleanInput('terraform_plan_destroy')) ? '-destroy' : [];
  const terraformTargets = core.getMultilineInput('terraform_targets').map((target) => `-target=${target}`);
  const terraformVariables = core.getInput('terraform_variables');
  const terraformWorkspace = core.getInput('terraform_workspace');
  const reportDrift = core.getBooleanInput('report_drift');
  const slackChannel = core.getInput('slack_channel_id');
  const slackBotToken = process.env.SLACK_BOT_TOKEN;

  let tf_version = '<unknown>';
  let tf_init = status_skipped;
  let tf_fmt = status_skipped;
  let tf_plan = status_skipped;
  let tf_apply = status_skipped;
  let tf_destroy = status_skipped;
  let tf_workspace_selection = status_skipped;
  let tf_workspace_creation = status_skipped;
  let tf_workspace_deletion = status_skipped;

  core.startGroup('Sanity checking inputs');
  if (/^\d+$/.test(terraformParallelism) === false) {
    core.setFailed(`Sanity checks failed. Non-integer value for 'terraform_parallelism': ${terraformParallelism}`);
    process.exit(1);
  }
  if (reportDrift === true) {
    if (terraformDoApply === true || terraformDoDestroy === true) {
      core.setFailed('Sanity checks failed. Can\'t apply or destroy when reporting drift');
      process.exit(1);
    }
    if (!slackChannel) {
      core.setFailed('Sanity checks failed. Slack channel id not specified.');
      process.exit(1);
    }
    if (!slackBotToken) {
      core.setFailed('Sanity checks failed. Slack bot token not provided.');
      process.exit(1);
    }
  }
  if (terraformDoApply === true && terraformDoDestroy === true) {
    core.setFailed('Sanity checks failed. Can\'t apply AND destroy in the same action');
    process.exit(1);
  }
  core.info('Good to go!');
  core.endGroup();

  core.startGroup('Configure Google Cloud credentials');
  fs.writeFileSync(`${process.env['HOME']}/gcloud.json`, core.getInput('google_credentials'));
  core.endGroup();

  core.startGroup('Run terraform version');
  const tfv = await terraform(terraformDirectory, ['version']);
  core.endGroup();
  if (tfv.status > 0) {
    core.info(`status: ${tfv.status}`);
    core.setFailed(`Failed to determine terraform version [err:${tfv.status}]`);
    terraformDoApply = false;
  } else {
    tf_version = tfv.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }

  core.startGroup('Run terraform init');
  let tfi_args = !terraformBackend ? ['init'] : ['init', '-backend-config=' + terraformBackend, '-reconfigure'];
  const tfi = await terraform(terraformDirectory, tfi_args);
  core.endGroup();
  if (tfi.status > 0) {
    tf_init = status_failed;
    core.setFailed(`Failed to initialize terraform [err:${tfi.status}]`);
    terraformDoApply = false;
  } else {
    tf_init = status_success;
  }

  /* VARIABLES START */
  core.startGroup('Assign terraform variables');
  if (terraformVariables) {
    const variables = JSON.parse(terraformVariables);
    for (let key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        process.env[`TF_VAR_${key}`] = variables[key];
        core.info(`Assigned variable ${key} with value ${variables[key]}`);
      }
    }
  } else {
    core.info('No variables to assign');
  }
  core.endGroup();
  /* VARIABLES END */

  /* WORKSPACE SELECTION START */
  core.startGroup('Run terraform workspace selection');
  core.startGroup(`Workspace input: ${terraformWorkspace}`);
  if (terraformWorkspace) {
    const tfws = await terraform(terraformDirectory, ['workspace', 'select', terraformWorkspace]);
    core.info(tfws.stdout);
    core.endGroup();

    if (tfws.status > 0) {
      tf_workspace_selection = status_failed;

      core.startGroup('Failed to select workspace (assuming non-existent), creating workspace...');
      const tfwc = await terraform(terraformDirectory, ['workspace', 'new', terraformWorkspace]);
      core.info(tfwc.stdout);
      core.endGroup();

      if (tfwc.status > 0) {
        tf_workspace_creation = status_failed;
        core.setFailed('Failed to create workspace');

        process.exit(1);
      } else {
        tf_workspace_selection = status_success;
        tf_workspace_creation = status_success;
      }
    } else {
      tf_workspace_selection = status_success;
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }
  /* WORKSPACE SELECTION END */

  core.startGroup('Run terraform fmt');
  const tffc = await terraform(terraformDirectory, ['fmt', '-check']);
  if (tffc.status > 0) {
    await terraform(terraformDirectory, ['fmt', '-diff', '-write=false', '-list=false']);
  }
  core.endGroup();
  if (tffc.status > 0) {
    tf_fmt = status_failed;
    core.setFailed(`Failed to pass terraform formatting checks [err:${tffc.status}]`);
    terraformDoApply = false;
  } else {
    tf_fmt = status_success;
  }

  if (reportDrift === true) {
    core.startGroup('Run terraform plan');
    let exitCode = 0;
    const slack = new WebClient(slackBotToken);
    const tfd = await terraform(terraformDirectory, ['plan', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-no-color', '-detailed-exitcode'].concat(terraformTargets));
    switch (tfd.status) {
    case 0:
      break;
    case 2: {
      core.warning('Terraform reported a diff');
      const result = await slack.chat.postMessage({
        icon_url: 'https://cdn.icon-icons.com/icons2/2107/PNG/512/file_type_terraform_icon_130125.png',
        text: `Unapplied changes were detected:\n*Repository:* ${process.env.GITHUB_REPOSITORY}\n*Working directory:* ${terraformDirectory}\n*Workspace:* ${terraformWorkspace}`,
        username: 'TreeHouse GitHub Actions',
        channel: slackChannel,
      });
      if (result.ok !== true) {
        core.setFailed(`Failed to report to slack [err:${result.error}]`);
        exitCode = 1;
      }
      break;
    }
    default:
      core.setFailed(`Failed to prepare the terraform plan [err:${tfp.status}]`);
      exitCode = 1;
      break;
    }
    core.endGroup();
    process.exit(exitCode);
  }

  core.startGroup('Run terraform plan');
  const tfp = await terraform(terraformDirectory, ['plan', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-out=terraform.plan'].concat(terraformTargets).concat(terraformPlanDestroy));
  core.endGroup();
  if (tfp.status > 0) {
    tf_plan = status_failed;
    core.setFailed(`Failed to prepare the terraform plan [err:${tfp.status}]`);
    terraformDoApply = false;
  } else {
    tf_plan = status_success;
  }

  core.startGroup('Run terraform apply');
  if (terraformDoApply === true) {
    const tfa = await terraform(terraformDirectory, ['apply', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-auto-approve'].concat(terraformTargets).concat('terraform.plan'));
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

  /* DESTROY START */
  core.startGroup('Run terraform destroy');
  if (terraformDoDestroy === true) {
    const tfd = await terraform(terraformDirectory, ['destroy', `-lock=${terraformLock}`, `-parallelism=${terraformParallelism}`, '-auto-approve'].concat(terraformTargets));
    core.info(tfd.stdout);
    core.endGroup();
    if (tfd.status > 0) {
      tf_destroy = status_failed;
      core.setFailed(`Failed to destroy resources [err:${tfd.status}]`);
    } else {
      tf_destroy = status_success;

      if (terraformWorkspace && terraformWorkspace !== 'default' && !terraformTargets) {
        core.startGroup('Run terraform workspace deletion');
        await terraform(terraformDirectory, ['workspace', 'select', 'default']); // have to switch to different workspace before deleting workspace defined in `terraformWorkspace`
        const tfwd = await terraform(terraformDirectory, ['workspace', 'delete', terraformWorkspace]); // have to switch to different workspace before deleting workspace defined in `terraformWorkspace`

        core.info(tfwd.stdout);
        core.endGroup();

        if (tfwd.status > 0) {
          tf_workspace_deletion = status_failed;
          core.setFailed(`Failed to delete terraform workspace [err:${tfwd.status}]`);
        } else {
          tf_workspace_deletion = status_success;
        }
      }
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }
  /* DESTROY END */

  core.info('');
  core.info(`Version: ${tf_version}`);
  core.info(`Initialization: ${tf_init}`);
  core.info(`Formatting: ${tf_fmt}`);
  core.info(`Workspace selection: ${tf_workspace_selection}`);
  core.info(`Workspace creation: ${tf_workspace_creation}`);
  core.info(`Plan: ${tf_plan}`);
  core.info(`Apply: ${tf_apply}`);
  core.info(`Destroy: ${tf_destroy}`);
  core.info(`Workspace deletion: ${tf_workspace_deletion}`);
})().catch(error => {
  core.setFailed(error.message);
});
