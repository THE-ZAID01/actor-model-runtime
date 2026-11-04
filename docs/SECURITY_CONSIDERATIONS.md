# Security considerations

This document describes security-relevant facts visible in the implementation;
it is not a security certification or penetration-test report.

## Current exposure and controls

- Public JSON API, browser form routes, internal coordinator routes, and worker
  message/drain routes have no authentication or authorization.
- The internal `/internal` API accepts worker registration and lease
  operations without an identity check. It should be reachable only from
  trusted API/worker networks.
- Worker registration validates a simple ID/URL shape but does not authenticate
  the registering process or restrict the advertised destination to an
  allowlist.
- JSON and URL-encoded request body sizes are limited in Express (API: 64 KiB
  JSON and 16 KiB form; worker: 32 KiB JSON). These limits are not a substitute
  for authorization or rate limiting.
- Actor IDs/types, message shape, operation length, and scale count are
  validated. Kubernetes RBAC is namespaced and restricts deployment patching
  to `actor-worker`.
- Sample Compose and Kubernetes database URLs do not use credentials. The
  Kubernetes file named `02-secrets.example.yaml` is an example Secret object,
  but its values are service URLs without credentials.
- No TLS termination, NetworkPolicy, rate limiting, CSRF protection for form
  submissions, security headers policy, or secret rotation workflow is
  configured in the inspected application/manifests.

## Safe deployment guidance

Do not expose API, worker ports, MongoDB, or Redis to untrusted networks without
adding appropriate controls. Before shared/production use:

1. Authenticate and authorize public and internal APIs; use separate identities
   for users and service processes.
2. Use TLS for external and service-to-service traffic where appropriate.
3. Configure MongoDB/Redis authentication, access restrictions, persistence,
   backups, and monitoring.
4. Replace example connection values with a managed secret workflow; do not
   commit credentials.
5. Apply Kubernetes NetworkPolicies, least-privilege RBAC, resource
   requests/limits, and hardened probes.
6. Add request rate limits, auditability, and security tests.
7. Review the actor-state/result write ordering and message retry semantics for
   the application's correctness and threat model.

## Operational boundary

The `Actor` document's `processedMessages` history is excluded from normal
queries, but it is not an access-control mechanism. Likewise, worker
generations and singleton lease tokens are correctness coordination data, not
user authentication credentials.

See [Limitations](LIMITATIONS_AND_FUTURE_SCOPE.md) and
[Kubernetes integration](KUBERNETES_INTEGRATION.md).
