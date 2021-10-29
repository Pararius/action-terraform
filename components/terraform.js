const {runTerraformCommand} = require("./shell");

exports.apply = function (terraformDirectory, terraformParallelism) {
    return runTerraformCommand(terraformDirectory, `apply -auto-approve -parallelism=${terraformParallelism}`);
}

exports.checkVersion = function (terraformDirectory) {
    return runTerraformCommand(terraformDirectory,'version');
}

exports.createWorkspace = function (terraformDirectory, terraformWorkspace) {
    return runTerraformCommand(terraformDirectory, `workspace new ${terraformWorkspace}`);
}

exports.deleteWorkspace = function (terraformDirectory, terraformWorkspace) {
    runTerraformCommand(terraformDirectory, `workspace select default`); // have to switch to different workspace before deleting workspace defined in `terraformWorkspace`

    return runTerraformCommand(terraformDirectory, `workspace delete ${terraformWorkspace}`);
}

exports.destroy = function (terraformDirectory, terraformParallelism) {
    return runTerraformCommand(terraformDirectory, `destroy -auto-approve -parallelism=${terraformParallelism}`);
}

exports.format = function (terraformDirectory) {
    return runTerraformCommand(terraformDirectory, 'fmt -check');
}

exports.formatDiff = function () {
    return runTerraformCommand('fmt -diff -write=false -list=false');
}


exports.init = function (terraformDirectory) {
    return runTerraformCommand(terraformDirectory, 'init');
}

exports.selectWorkspace = function (terraformDirectory, terraformWorkspace) {
    return runTerraformCommand(terraformDirectory, `workspace select ${terraformWorkspace}`);
}