#!/usr/bin/env bash
set -euo pipefail
# Local Supabase only: independent concurrent sessions roll back synthetic rows.
container='supabase_db_charitable-case-system'
output=$(seq 1 20 | xargs -P 20 -I '{}' docker exec "$container" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "begin; insert into public.families(name) values ('أسرة وهمية') returning code; select pg_sleep(0.3); rollback;" | sed '/^$/d')
count=$(printf '%s\n' "$output" | wc -l)
unique=$(printf '%s\n' "$output" | sort -u | wc -l)
if [[ "$count" -ne 20 || "$unique" -ne 20 ]]; then
  echo "Expected 20 unique concurrent codes, got $count rows and $unique unique" >&2
  exit 1
fi
echo "20 concurrent rolled-back family inserts produced 20 unique codes"
