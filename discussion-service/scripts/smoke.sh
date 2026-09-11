#!/usr/bin/env bash
# End-to-end smoke against the local stack: Keycloak (dev realm), user-service and discussion-service.
# Needs: docker compose up -d postgres keycloak; the tennis_discussion and tennis_users databases
# (docs/DEVELOPMENT.md); user-service running on 8092, since discussion-service resolves every reader
# token through it; discussion-service on 8093 (or via the gateway with BASE=http://localhost:8090);
# jq, curl.
#
# Portable between macOS and Linux: no /proc, and the two date dialects are both tried.
set -euo pipefail

BASE="${BASE:-http://localhost:8093}"
KC="${KC:-http://localhost:8180/realms/tennis-wire/protocol/openid-connect/token}"
API="$BASE/api/discussion"

new_uuid() {
  if command -v uuidgen > /dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'   # macOS uuidgen shouts
  else
    cat /proc/sys/kernel/random/uuid
  fi
}
SUBJECT="${SUBJECT:-$(new_uuid)}"

# +1h in ISO-8601, GNU date first, BSD date second.
in_one_hour() {
  date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ 2> /dev/null || date -u -v+1H +%Y-%m-%dT%H:%M:%SZ
}

token() {
  curl -sf -d grant_type=password -d client_id=dev-cli -d "username=$1" -d "password=$1" "$KC" | jq -r .access_token
}

# The JWT payload is base64url; jq's @base64d wants plain base64, so translate the
# alphabet and restore the padding before decoding. ("=" * 0 is null in jq, hence // "".)
sub() {
  echo "$1" | jq -Rr 'split(".")[1]
    | gsub("-"; "+") | gsub("_"; "/")
    | . + (("=" * ((4 - (length % 4)) % 4)) // "")
    | @base64d | fromjson | .sub'
}

# Expect status $1 from the request described by the remaining args; print the body.
expect() {
  local want="$1"; shift
  local out; out=$(curl -s -o /tmp/smoke.body -w '%{http_code}' "$@")
  if [ "$out" != "$want" ]; then
    echo "FAIL: expected $want, got $out for: $*" >&2; cat /tmp/smoke.body >&2; echo >&2; exit 1
  fi
  cat /tmp/smoke.body
}

READER=$(token reader)   # role user
DEV=$(token dev)         # admin -> user + author + moderator
json='Content-Type: application/json'

# User ids are issued by user-service, so they are read off the comments each account creates.
echo "# reader posts a top-level comment"
CREATED=$(expect 201 -X POST "$API/comments" -H "Authorization: Bearer $READER" -H "$json" \
  -d "{\"subjectType\":\"article\",\"subjectId\":\"$SUBJECT\",\"body\":\"first\"}")
ROOT=$(jq -r .comment.id <<< "$CREATED"); READER_ID=$(jq -r .comment.authorId <<< "$CREATED")

echo "# the author id is the user-service id, not the Keycloak subject"
if [ "$READER_ID" = "$(sub "$READER")" ]; then
  echo "FAIL: authorId equals the token sub" >&2; exit 1
fi

echo "# dev replies; not muted yet"
CREATED=$(expect 201 -X POST "$API/comments/$ROOT/replies" -H "Authorization: Bearer $DEV" -H "$json" \
  -d '{"body":"reply"}')
REPLY=$(jq -r .comment.id <<< "$CREATED"); DEV_ID=$(jq -r .comment.authorId <<< "$CREATED")

echo "# anonymous read: 1 top-level with replyCount=1"
expect 200 "$API/comments?subjectType=article&subjectId=$SUBJECT" | jq -e '.items | length == 1 and .[0].replyCount == 1' > /dev/null

echo "# anonymous write: 401"
expect 401 -X POST "$API/comments" -H "$json" -d '{"subjectType":"article","subjectId":"'"$SUBJECT"'","body":"x"}' > /dev/null

echo "# reader blocks dev (gravestone)"
expect 200 -X PUT "$API/blocks/$DEV_ID" -H "Authorization: Bearer $READER" -H "$json" -d '{"mode":"gravestone"}' > /dev/null

echo "# branch as reader: dev's reply is a gravestone; as anonymous it is visible"
expect 200 "$API/comments/$ROOT/branch" -H "Authorization: Bearer $READER" | jq -e '.root.replies[0].visibility == "gravestone" and (.root.replies[0].body == null)' > /dev/null
expect 200 "$API/comments/$ROOT/branch" | jq -e '.root.replies[0].visibility == "visible"' > /dev/null

echo "# dev replies again: now muted by the recipient"
expect 201 -X POST "$API/comments/$ROOT/replies" -H "Authorization: Bearer $DEV" -H "$json" -d '{"body":"still stored"}' | jq -e '.mutedByRecipient == true' > /dev/null

echo "# ancestry of the reply: root first"
expect 200 "$API/comments/$REPLY/ancestry" | jq -e ".chain | length == 2 and .[0].id == \"$ROOT\"" > /dev/null

echo "# self-block: 400"
expect 400 -X PUT "$API/blocks/$READER_ID" -H "Authorization: Bearer $READER" -H "$json" -d '{"mode":"soft"}' > /dev/null

echo "# moderator restricts reader for 1h; reader's next post is 403 with restrictedUntil"
UNTIL=$(in_one_hour)
RESTRICTION=$(expect 201 -X POST "$API/moderation/restrictions" -H "Authorization: Bearer $DEV" -H "$json" \
  -d "{\"userId\":\"$READER_ID\",\"expiresAt\":\"$UNTIL\",\"reason\":\"smoke\"}" | jq -r .id)
expect 403 -X POST "$API/comments" -H "Authorization: Bearer $READER" -H "$json" \
  -d "{\"subjectType\":\"article\",\"subjectId\":\"$SUBJECT\",\"body\":\"nope\"}" | jq -e '.error == "COMMENTING_RESTRICTED" and .details.restrictedUntil != null' > /dev/null

echo "# lift it; reader can post again; reader may not lift (moderator only)"
expect 403 -X DELETE "$API/moderation/restrictions/$RESTRICTION" -H "Authorization: Bearer $READER" > /dev/null
expect 204 -X DELETE "$API/moderation/restrictions/$RESTRICTION" -H "Authorization: Bearer $DEV" > /dev/null
expect 201 -X POST "$API/comments" -H "Authorization: Bearer $READER" -H "$json" \
  -d "{\"subjectType\":\"article\",\"subjectId\":\"$SUBJECT\",\"body\":\"back\"}" > /dev/null

echo "# soft delete: dev cannot delete reader's root; reader can; node survives with visibility=deleted"
expect 403 -X DELETE "$API/comments/$ROOT" -H "Authorization: Bearer $DEV" > /dev/null
expect 204 -X DELETE "$API/comments/$ROOT" -H "Authorization: Bearer $READER" > /dev/null
expect 200 "$API/comments/$ROOT/branch" | jq -e '.root.visibility == "deleted" and .root.body == null and (.root.replies | length == 2)' > /dev/null

echo "# unblock is idempotent"
expect 204 -X DELETE "$API/blocks/$DEV_ID" -H "Authorization: Bearer $READER" > /dev/null
expect 204 -X DELETE "$API/blocks/$DEV_ID" -H "Authorization: Bearer $READER" > /dev/null

echo "OK (subject $SUBJECT)"
