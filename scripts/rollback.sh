#!/bin/bash
# Project Manager - Rollback Script
# Usage: ./scripts/rollback.sh [image-tag]
# If no tag provided, rolls back to the previous image

set -euo pipefail

IMAGE_TAG="${1:-}"

if [ -z "${IMAGE_TAG}" ]; then
    echo "No image tag specified. Listing available tags..."
    docker images --format "{{.Repository}}:{{.Tag}}" | grep project-manager | head -5
    echo ""
    echo "Usage: $0 <image-tag>"
    exit 1
fi

echo "Rolling back to image: ${IMAGE_TAG}"

# Stop current containers
docker compose down

# Pull the specified image
docker pull "${IMAGE_TAG}"

# Update compose to use the specific image
export IMAGE="${IMAGE_TAG}"
docker compose up -d

# Wait for health check
echo "Waiting for health check..."
for i in $(seq 1 30); do
    if curl -fsS http://localhost:4000/health > /dev/null 2>&1; then
        echo "✅ Rollback successful - health check passed"
        exit 0
    fi
    sleep 2
done

echo "❌ Rollback failed - health check did not pass"
exit 1
