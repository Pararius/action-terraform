# Terraform

[GitHub Action](https://github.com/features/actions) to automate Terraform workflows.

## Usage

```yaml
- uses: Pararius/action-terraform@0.0.9
  name: Terraform
  with:
    # Google credentials, required for accessing state bucket
    google_credentials: ''

    # Location of terraform manifests, relative to the current working directory
    # Default: ./
    terraform_directory: ''

    # Whether to run `terraform apply` as last step
    # Default: 'false'
    terraform_do_apply: ''

    # Whether to run `terraform destroy` (`terraform_do_apply` and
    # `terraform_do_destroy` can not both be true)
    # Default: 'false'
    terraform_do_destroy: ''

    # Whether to (try to) lock the state during plan/apply. Reccommended when
    # terraform_do_apply or terraform_do_destroy is set to 'true'
    # Default: 'false'
    terraform_lock: ''

    # Limit the number of concurrent operations during plan/apply
    # Default: '10'
    terraform_parallelism: ''

    # A multiline string containing targets that should be passed to terraform
    # (one per line)
    terraform_targets: ''

    # A JSON string containing variables that should be passed to terraform.
    # For example: {"my_var": "my_value"}
    terraform_variables: ''

    # The name of the workspace that resources should be applied in. When left
    # empty, the terraform default is used
    terraform_workspace: ''
```

## Example

### Only run terraform plan, without locking the workspace

```yaml
- uses: Pararius/action-terraform@0.0.9
  name: Terraform
  with:
    google_credentials: ${{ secrets.YOUR_SECRET }}
    terraform_directory: ./terraform/
    terraform_do_apply: false
```

### Also run terraform apply, locking the workspace

```yaml
- uses: Pararius/action-terraform@0.0.9
  name: Terraform
  with:
    google_credentials: ${{ secrets.YOUR_SECRET }}
    terraform_directory: ./terraform/
    terraform_do_apply: true
    terraform_lock: true
```
