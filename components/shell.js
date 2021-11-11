const core = require("@actions/core");
const {spawnSync} = require("child_process");
const tc = require("@actions/tool-cache");
const {runCommand} = require("./shell");
const fs = require("fs");

exports.installTerraformSwitcher = async function () {
    const tfsPath = await tc.downloadTool('https://raw.githubusercontent.com/warrensbox/terraform-switcher/release/install.sh');

    return runCommand(`chmod +x ${tfsPath} && ${tfsPath} -b ${process.env['HOME']}/`);
}

exports.prepareGoogleCloudCredentials = function (credentials_json) {
    fs.writeFileSync(`${process.env['HOME']}/gcloud.json`, credentials_json);
}

exports.runCommand = function (command, options) {
    const sh = spawnSync('/bin/sh', ['-c', `${command} 2>&1`], {
        ...{
            env: {
                ...process.env,
                ...{'GOOGLE_APPLICATION_CREDENTIALS': `${process.env['HOME']}/gcloud.json`}
            },
            ...options
        }
    });

    return {
        status: sh.status,
        stderr: sh.stderr.toString(),
        stdout: sh.stdout.toString()
    }
}

exports.runTerraformCommand = function (terraformDirectory, params) {
    return exports.runCommand(`${process.env['HOME']}/terraform ${params}`, {
        cwd: core.getInput('terraform_directory')
    });
}

exports.runTerraformSwitcher = function (terraformDirectory) {
    return runCommand(`${process.env['HOME']}/tfswitch -b ${process.env['HOME']}/terraform`, {
        cwd: terraformDirectory
    });
}

exports.setVariable = function (key, value) {
    return runCommand(`printf '%s' '${key}' > ${value}`);
}
