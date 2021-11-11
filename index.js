import * as shell from './components/shell';
import * as terraform from './components/terraform';
const core = require('@actions/core');
const statusSkipped = '﹣';
const statusSuccess = '✓';
const statusFailed = '✕';

(async () => {
  const terraformDirectory = core.getInput('terraform_directory');
  const terraformDoApply = core.getInput('terraform_do_apply') === 'true';
  const terraformDoDestroy = core.getInput('terraform_do_destroy') === 'true';
  const terraformParallelism = core.getInput('terraform_parallelism');
  const terraformVariables = core.getInput('terraform_variables');
  const terraformWorkspace = core.getInput('terraform_workspace');

  // changeable states
  let statusTerraformApply;
  let statusTerraformDestroy = statusSkipped;
  let statusTerraformFormat;
  let statusTerraformInit;
  let statusTerraformVersion = '<unknown>';
  let statusTerraformWorkspaceCreation = statusSkipped;
  let statusTerraformWorkspaceDeletion = statusSkipped;
  let statusTerraformWorkspaceSelection = statusSkipped;

  core.startGroup('Sanity checking inputs');
  if (/^\d+$/.test(terraformParallelism) === false) {
    core.setFailed(`Sanity checks failed. Non-integer value for 'terraform_parallelism': ${terraformParallelism}`);
    process.exit(1);
  }
  if (terraformDoApply === true && terraformDoDestroy === true) {
    core.setFailed('Sanity checks failed. Can\'t apply AND destroy in the same action');
    process.exit(1);
  }
  core.info('Good to go!');
  core.endGroup();

  core.startGroup('Configure Google Cloud credentials');
  shell.prepareGoogleCloudCredentials(core.getInput('google_credentials'));
  core.endGroup();

  core.startGroup('Setup Terraform CLI');
  core.info(`Working directory: ${terraformDirectory}`);
  core.info('Installing tfswitch:');
  const install_terraform_switcher_result = await shell.installTerraformSwitcher();
  core.info(install_terraform_switcher_result.stdout);
  core.info(install_terraform_switcher_result.stderr);
  core.info('Running tfswitch:');
  const run_terraform_switcher_result = shell.runTerraformSwitcher(terraformDirectory);
  core.info(run_terraform_switcher_result.stdout);
  core.info(run_terraform_switcher_result.stderr);
  core.endGroup();
  if (run_terraform_switcher_result.status > 0) {
    core.setFailed(`Failed to determine which terraform version to use [err:${run_terraform_switcher_result.status}]`);
    process.exit(1);
  }

  /* VERSION CHECK START */
  core.startGroup('Run terraform version');
  const check_version_result = terraform.checkVersion(terraformDirectory);
  core.info(check_version_result.stdout);
  core.info(check_version_result.stderr);
  core.endGroup();
  if (check_version_result.status > 0) {
    core.info(`status: ${check_version_result.status}`);
    core.setFailed(`Failed to determine terraform version [err:${check_version_result.status}]`);
    process.exit(1);
  } else {
    statusTerraformVersion = check_version_result.stdout.replace(/\r?\n|\r/g, ' ').match(/ v([0-9]+\.[0-9]+\.[0-9]+) /)[1];
  }
  /* VERSION CHECK END */

  /* VARIABLES START */
  core.startGroup('Assign terraform variables');
  if (terraformVariables) {
    let variables = JSON.parse(terraformVariables);
    for (let key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        shell.setVariable(`TF_VAR_${key}`, variables[key]);
        core.info(`Assigned variable ${key} with value ${variables[key]}`);
      }
    }
  } else {
    core.info('No variables to assign');
  }
  core.endGroup();
  /* VARIABLES END */

  /* INIT START */
  core.startGroup('Run terraform init');
  const resultTerraformInit = terraform.init(terraformDirectory);
  core.info(resultTerraformInit.stdout);
  core.endGroup();
  if (resultTerraformInit.status > 0) {
    statusTerraformInit = statusFailed;
    core.setFailed(`Failed to initialize terraform [err:${resultTerraformInit.status}]`);
    process.exit(1);
  } else {
    statusTerraformInit = statusSuccess;
  }
  /* INIT END */

  /* WORKSPACE SELECTION START */
  core.startGroup('Run terraform workspace selection');
  core.startGroup(`Workspace input: ${terraformWorkspace}`);
  if (terraformWorkspace) {
    const select_workspace_result = terraform.selectWorkspace(terraformDirectory, terraformWorkspace);
    core.info(select_workspace_result.stdout);
    core.endGroup();

    if (select_workspace_result.status > 0) {
      statusTerraformWorkspaceSelection = statusFailed;

      core.startGroup('Failed to select workspace (assuming non-existent), creating workspace...');
      const create_workspace_result = terraform.createWorkspace(terraformDirectory, terraformWorkspace);
      core.info(create_workspace_result.stdout);
      core.endGroup();

      if (create_workspace_result.status > 0) {
        statusTerraformWorkspaceCreation = statusFailed;
        core.setFailed('Failed to create workspace');

        process.exit(1);
      } else {
        statusTerraformWorkspaceSelection = statusSuccess;
        statusTerraformWorkspaceCreation = statusSuccess;
      }
    } else {
      statusTerraformWorkspaceSelection = statusSuccess;
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }
  /* WORKSPACE SELECTION END */

  /* FORMATTING START */
  core.startGroup('Run terraform fmt');
  const resultTerraformFormat = terraform.format(terraformDirectory);
  if (resultTerraformFormat.status > 0) {
    const format_diff_result = terraform.formatDiff(terraformDirectory);
    core.info(format_diff_result.stdout);
    statusTerraformFormat = statusFailed;
    core.setFailed(`Failed to pass terraform formatting checks [err:${resultTerraformFormat.status}]`);
    process.exit(1);
  } else {
    statusTerraformFormat = statusSuccess;
  }
  core.endGroup();
  /* FORMATTING END */

  /* APPLY START */
  core.startGroup('Run terraform apply');
  if (terraformDoApply === true) {
    const resultTerraformApply = terraform.apply(terraformDirectory, terraformParallelism);
    core.info(resultTerraformApply.stdout);
    core.endGroup();
    if (resultTerraformApply.status > 0) {
      statusTerraformApply = statusFailed;
      core.setFailed(`Failed to apply terraform plan [err:${resultTerraformApply.status}]`);
    } else {
      statusTerraformApply = statusSuccess;
    }
  } else {
    core.info('Skipped');
    core.endGroup();
    statusTerraformApply = statusSkipped;
  }
  /* APPLY END */

  /* DESTROY START */
  core.startGroup('Run terraform destroy');
  if (terraformDoDestroy === true) {
    const destroy_result = terraform.destroy(terraformDirectory, terraformParallelism);
    core.info(destroy_result.stdout);
    core.endGroup();
    if (destroy_result.status > 0) {
      statusTerraformDestroy = statusFailed;
      core.setFailed(`Failed to destroy resources [err:${destroy_result.status}]`);
    } else {
      statusTerraformDestroy = statusSuccess;

      if (terraformWorkspace) {
        core.startGroup('Run terraform workspace deletion');
        const deleteWorkspaceResult = terraform.deleteWorkspace(terraformDirectory, terraformWorkspace);
        core.info(deleteWorkspaceResult.stdout);
        core.endGroup();

        if (deleteWorkspaceResult.status > 0) {
          statusTerraformWorkspaceDeletion = statusFailed;
          core.setFailed(`Failed to delete terraform workspace [err:${deleteWorkspaceResult.status}]`);
        } else {
          statusTerraformWorkspaceDeletion = statusSuccess;
        }
      }
    }
  } else {
    core.info('Skipped');
    core.endGroup();
  }
  /* DESTROY END */

  core.info('');
  core.info(`Version: ${statusTerraformVersion}`);
  core.info(`Workspace creation: ${statusTerraformWorkspaceCreation}`);
  core.info(`Workspace selection: ${statusTerraformWorkspaceSelection}`);
  core.info(`Initialization: ${statusTerraformInit}`);
  core.info(`Formatting: ${statusTerraformFormat}`);
  core.info(`Apply: ${statusTerraformApply}`);
  core.info(`Destroy: ${statusTerraformDestroy}`);
  core.info(`Workspace deletion: ${statusTerraformWorkspaceDeletion}`);
})().catch(error => {
  core.setFailed(error.message);
});
