const {spawnSync} = require("child_process");
const tc = require("@actions/tool-cache");
const fs = require("fs");

exports.installTerraformSwitcher = async function () {
    const tfsPath = await tc.downloadTool('https://raw.githubusercontent.com/warrensbox/terraform-switcher/release/install.sh');

    return exports.runCommand(`chmod +x ${tfsPath} && ${tfsPath} -b ${process.env['HOME']}/`);
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
        cwd: terraformDirectory
    });
}

exports.runTerraformSwitcher = function (terraformDirectory) {
    return exports.runCommand(`${process.env['HOME']}/tfswitch -b ${process.env['HOME']}/terraform`, {
        cwd: terraformDirectory
    });
}

exports.setVariable = function (key, value) {
    return exports.runCommand(`printf '%s' '${key}' > ${value}`);
}
