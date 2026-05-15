# Migrations

Histórico versionado das migrations aplicadas via Supabase MCP em `ibkyqpatestghbdxgqup`.

## Ordem (timestamp prefix)

| Version | Name | Resumo |
|---|---|---|
| `20260507184552` | admin_phase2_audit_idempotency | `notifications.retry_count`, `reservations.customer_ack_at`, `reservation_audit_log`, `idempotency_keys`, `lock_reservation()` |
| `20260507200235` | admin_phase3_product_audit | `admin_audit_log` (genérico para entities) |
| `20260508005034` | commission_provider_products | `provider_products` (FK + UNIQUE), snapshot `reservations.provider_id` + `commission_amount` |
| `20260514183604` | webhook_idempotency_and_preference_split | UNIQUE `payments(gateway, gateway_id)`, separar `gateway_preference_id` de `gateway_payment_id` |
| `20260514183804` | try_reserve_seats_rpc | RPC inicial — DEPRECATED (substituída na próxima) |
| `20260514183840` | reserve_seat_atomic_rpc | RPC `reserve_seat_atomic()` (advisory lock + check + insert atomic) |
| `20260514211212` | storage_buckets_rls | Buckets `vouchers` (privado) + `product-photos` (público read), policies storage.objects |
| `20260514211342` | notification_jobs_retry | Queue persistente `notification_jobs` + RPC `claim_notification_jobs()` |

## Reset/rebuild local

Base inicial está em [`../schema.sql`](../schema.sql). Para reconstruir do zero:

```sh
psql $DATABASE_URL -f backend/db/schema.sql
for f in backend/db/migrations/*.sql; do
  psql $DATABASE_URL -f "$f"
done
```

## Aplicar nova migration

Via Supabase MCP: `mcp__claude_ai_Supabase__apply_migration` com `name` snake_case e `query` SQL. Depois salvar `<timestamp>_<name>.sql` aqui.
