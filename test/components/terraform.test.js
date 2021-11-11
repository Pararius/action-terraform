const assert = require('assert');
const shell = require('../../components/shell');
const sinon = require('sinon');
const terraform = require('../../components/terraform');
const terraform_command_prefix = '/root/terraform';

describe('Apply', function () {
  let stub;
  after(function () {
    sinon.verifyAndRestore(); // Unwraps the spy
  });

  it('Uses the correct arguments in the command', function () {
    let terraformDirectory = './my/dir';
    let terraformParallelism = 'Alice';
    let value = {status: 0, stdout: 'This is my output'};

    stub = sinon.stub(shell, 'runCommand').returns(value);
    assert.equal(terraform.apply(terraformDirectory, terraformParallelism), value);
    sinon.assert.calledWith(stub, `${terraform_command_prefix} apply -auto-approve -parallelism=${terraformParallelism}`);
  });
});

describe('Delete workspace', function () {
  let stub;
  after(function () {
    sinon.verifyAndRestore(); // Unwraps the spy
  });

  it('Uses the correct arguments in the commands', function () {
    let terraformDirectory = './my/dir';
    let terraformWorkspace = 'Alice';
    let value = {status: 0, stdout: 'This is my output'};

    stub = sinon.stub(shell, 'runCommand').returns(value);
    assert.equal(terraform.deleteWorkspace(terraformDirectory, terraformWorkspace), value);

    sinon.assert.calledTwice(stub);
    sinon.assert.callOrder(
      stub.withArgs(`${terraform_command_prefix} workspace select default`),
      stub.withArgs(`${terraform_command_prefix} workspace delete ${terraformWorkspace}`),
    );
  });
});

describe('Destroy', function () {
  let stub;
  after(function () {
    sinon.verifyAndRestore(); // Unwraps the spy
  });

  it('Uses the correct arguments in the command', function () {
    let terraformDirectory = './my/dir';
    let terraformParallelism = 'Alice';
    let value = {status: 0, stdout: 'This is my output'};

    stub = sinon.stub(shell, 'runCommand').returns(value);
    assert.equal(terraform.destroy(terraformDirectory, terraformParallelism), value);
    sinon.assert.calledWith(stub, `${terraform_command_prefix} destroy -auto-approve -parallelism=${terraformParallelism}`);
  });
});
