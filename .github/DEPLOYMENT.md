# GKE deployment configuration

The `test` job always runs. Image publishing and GKE deployment run only on a
push to `main` after the following repository variables are configured:

| Variable | Example |
| --- | --- |
| `GCP_PROJECT_ID` | `my-gcp-project` |
| `GKE_CLUSTER` | `healthwatch-cluster` |
| `GKE_ZONE` | `asia-south1-a` |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `github-deploy@my-gcp-project.iam.gserviceaccount.com` |

The deployment service account must be configured for GitHub Actions workload
identity federation and be allowed to push images and deploy to the target GKE
cluster. This avoids storing a long-lived Google service-account JSON key in
GitHub.

Before the first deployment, create the Kubernetes secret out of band. Never
commit its value:

```sh
kubectl create namespace healthwatch --dry-run=client -o yaml | kubectl apply -f -
kubectl -n healthwatch create secret generic healthwatch-secrets \
  --from-literal=JWT_SECRET_KEY="$(openssl rand -hex 32)"
```

Rotate the previously committed `JWT_SECRET_KEY`, PostgreSQL password, and any
Google service-account key immediately. Removing a secret from the current
branch does not remove it from Git history.
