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

    # Limit the number of concurrent operations during plan/apply
    # Default: '10'
    terraform_parallelism: ''
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
```
