#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
IMAGE_NAME="${IMAGE_NAME:-kudapass:prod}"
CONTAINER_NAME="${CONTAINER_NAME:-kudapass}"
PORT_MAPPING="${PORT_MAPPING:-3000:3000}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it first, for example: cp .env.example .env"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

required_vars=(
  NEXT_PUBLIC_SITE_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  TWILIO_CONTENT_SID_VERIFICATION
  WHATSAPP_LOGIN_CODE_SECRET
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Required variable is missing in $ENV_FILE: $var_name"
    exit 1
  fi
done

echo "Building image $IMAGE_NAME"
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_YANDEX_MAPS_API_KEY="${NEXT_PUBLIC_YANDEX_MAPS_API_KEY:-}" \
  --build-arg NEXT_PUBLIC_TZ="${NEXT_PUBLIC_TZ:-Asia/Almaty}" \
  -t "$IMAGE_NAME" \
  "$ROOT_DIR"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "Stopping old container $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME"
fi

echo "Starting container $CONTAINER_NAME"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "$PORT_MAPPING" \
  "$IMAGE_NAME"

echo "Container is up:"
docker ps --filter "name=$CONTAINER_NAME"
