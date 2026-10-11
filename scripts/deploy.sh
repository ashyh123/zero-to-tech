#!/usr/bin/env bash
set -euo pipefail
: "${SSH_HOST:?}" "${SSH_USER:?}" "${SSH_PRIVATE_KEY:?}" "${SSH_KNOWN_HOSTS:?}" "${DEPLOY_ROOT:?}" "${RELEASE_ID:?}" "${SITE_URL:?}"
SSH_PORT=${SSH_PORT:-22}
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9.-]+$ && "$SSH_USER" =~ ^[a-zA-Z0-9_-]+$ && "$SSH_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ROOT" =~ ^/[a-zA-Z0-9/_-]+$ && "$RELEASE_ID" =~ ^[0-9]+-[0-9]+$ ]]
[[ "$SITE_URL" =~ ^https?:// && "$SITE_URL" != *localhost* ]]
test -s out/index.html
test -s out/sitemap.xml
TASK_SSH_DIR=$(mktemp -d)
trap 'rm -rf "$TASK_SSH_DIR"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$TASK_SSH_DIR/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$TASK_SSH_DIR/known_hosts"
chmod 600 "$TASK_SSH_DIR/key" "$TASK_SSH_DIR/known_hosts"
SSH_OPTIONS=(-i "$TASK_SSH_DIR/key" -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$TASK_SSH_DIR/known_hosts")
REMOTE="$SSH_USER@$SSH_HOST"
RELEASE="$DEPLOY_ROOT/releases/$RELEASE_ID"
ssh "${SSH_OPTIONS[@]}" "$REMOTE" "mkdir -p '$DEPLOY_ROOT/releases'; test ! -e '$RELEASE'; mkdir '$RELEASE'"
# Upload completes before changing the current release; failed builds/uploads keep the old site.
rsync -az -e "ssh -i $TASK_SSH_DIR/key -p $SSH_PORT -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$TASK_SSH_DIR/known_hosts" out/ "$REMOTE:$RELEASE/"
ssh "${SSH_OPTIONS[@]}" "$REMOTE" "if test -d '$DEPLOY_ROOT/current/_astro'; then rsync -a --ignore-existing '$DEPLOY_ROOT/current/_astro/' '$RELEASE/_astro/'; fi"
ssh "${SSH_OPTIONS[@]}" "$REMOTE" "test -s '$RELEASE/index.html' && test -s '$RELEASE/sitemap.xml' && ln -s '$RELEASE' '$DEPLOY_ROOT/.current-$RELEASE_ID' && mv -Tf '$DEPLOY_ROOT/.current-$RELEASE_ID' '$DEPLOY_ROOT/current'"
