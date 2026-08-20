#!/bin/bash
# Jal Jeevan Swasthya — GKE Deployment Script
# Prerequisites: gcloud CLI authenticated, project set, Docker built
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-healthwatch-ne}"
REGION="${REGION:-asia-south1}"
ZONE="${ZONE:-asia-south1-a}"
CLUSTER="healthwatch-cluster"
NAMESPACE="healthwatch"

echo "=== Jal Jeevan Swasthya Deployment ==="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Cluster:  $CLUSTER"

# ── Step 1: Authenticate & configure ──────────────────────────────────
gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

# ── Step 2: Get GKE credentials ───────────────────────────────────────
gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONE"

# ── Step 3: Build & push Docker images ────────────────────────────────
echo "--- Building images ---"
gcloud builds submit --config cloudbuild.yaml .

# ── Step 4: Create namespace ──────────────────────────────────────────
kubectl apply -f k8s/namespace.yaml

# ── Step 5: Create secrets ────────────────────────────────────────────
JWT_KEY=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -base64 24)
kubectl create secret generic healthwatch-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=JWT_SECRET_KEY="$JWT_KEY" \
  --from-literal=POSTGRES_PASSWORD="$DB_PASS" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── Step 6: Apply configmap + deployments ─────────────────────────────
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/backend-hpa.yaml
kubectl apply -f k8s/ingress.yaml

# ── Step 7: Wait for rollout ──────────────────────────────────────────
echo "--- Waiting for backend rollout ---"
kubectl rollout status deployment/healthwatch-backend -n "$NAMESPACE" --timeout=300s
echo "--- Waiting for frontend rollout ---"
kubectl rollout status deployment/healthwatch-frontend -n "$NAMESPACE" --timeout=120s

echo "=== Deployment Complete ==="
echo "Ingress IP:"
kubectl get ingress healthwatch-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
echo ""
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
echo "HPA:"
kubectl get hpa -n "$NAMESPACE"
