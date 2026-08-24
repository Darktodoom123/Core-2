# Field Emergency SOS runbook

## Current release state

Field Emergency SOS is implemented behind `SOS_ENABLED=false`. Do not enable it in production until the real responder delivery provider, designated company emergency-contact roster, escalation monitoring, Reverb/realtime delivery, staging drills, and physical Android acceptance gates are complete.

## Operational behavior

- Authenticated active field workers may hold the global Android SOS control for two seconds. A normal tap does not activate it.
- The server attaches the worker's active dispatch and assigned asset when valid; otherwise the incident remains valid without context.
- Categories are vehicular accident, site accident, critical asset malfunction, other immediate danger, and unclassified.
- Initial alerts are delivered only to the assigned Dispatcher and active Operations Managers. Field Technicians are not recipients.
- An unacknowledged incident escalates at the server deadline (default 180 seconds) to the configured company emergency contacts. Public authorities are never contacted automatically.
- Mobile offline attempts are retained in the emergency-priority outbox for the bounded retry window (default 15 minutes), with deliberate call/SMS actions available to the worker.

## Responder workflow

Use the persistent SOS banner and responder queue in the Operations workspace. Acknowledge first to take ownership, then resolve with an audited outcome and closure note. Record a false alarm through the cancel action; do not delete the incident. The incident and delivery evidence remain auditable.

## Incident response checks

1. Confirm the incident status, worker, dispatch/asset context, received time, and acknowledgement deadline.
2. Acknowledge from the queue if safe to do so; the first acknowledgement wins under a server row lock.
3. Use the worker call action only when appropriate; the application does not place the call automatically.
4. For escalation, verify delivery attempts and provider/monitoring evidence before resolving.
5. Preserve the incident ID and audit trail in any follow-up report.

## Enablement checklist

- Provider credentials, delivery failure handling, retry policy, and emergency queue monitoring approved.
- Company emergency contacts entered by an authorized System Administrator and verified by a test drill.
- Realtime delivery, polling fallback, notification center, and dashboard alerting observed in staging.
- Three-minute acknowledgement/escalation drill completed without public-authority auto-contact.
- Android development-build, cold-start, offline, GPS timeout, accessibility, call/SMS handoff, and physical-device acceptance evidence attached.
- Only then set `SOS_ENABLED=true` in the intended environment and repeat smoke checks.
