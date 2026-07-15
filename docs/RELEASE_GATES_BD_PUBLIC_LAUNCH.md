# Release Gates For Bangladesh Public Launch

Use this as the go/no-go checklist before production rollout.

## A. Test And Build Gates

- [ ] Frontend build passes (`frontend`)
- [ ] Admin CRM build passes (`admin-frontend-react`)
- [ ] Java backend tests/build pass (`backend-java`)
- [ ] Playwright E2E matrix passes (chromium, mobile-safari, admin)
- [ ] No critical/high severity dependency vulnerabilities open

## B. Security And Session Gates

- [ ] CSP in enforce mode (or approved temporary report-only exception)
- [ ] Secure cookie/session/token settings validated in production config
- [ ] Admin auth hardening verified (rate limits, IP allowlist/proxy trust)
- [ ] CORS allowlist uses explicit origins (no broad wildcard in prod)
- [ ] Audit logging enabled for admin mutations and auth events

## C. Payments, Orders, And Fulfillment

- [ ] Payment methods for Bangladesh verified end-to-end (sandbox + production credentials)
- [ ] Checkout success/failure/retry flows validated
- [ ] Order lifecycle transitions verified from placed -> delivered -> return/refund paths
- [ ] Courier fallback policy configured and tested
- [ ] Inventory reservation/release correctness validated under concurrent checkouts

## D. Observability And Incident Readiness

- [ ] Correlation/request-id propagation confirmed across storefront/BFF/Java
- [ ] Error and latency dashboards available for critical endpoints
- [ ] Alert routing tested (on-call receives and acknowledges)
- [ ] Runbooks present for auth outage, payment outage, and DB recovery
- [ ] Sentry/OTel environment labels and release versions populated

## E. Data Safety And Recovery

- [ ] Automated daily backup job enabled
- [ ] Restore drill executed in last 30 days
- [ ] RPO/RTO documented and accepted by business
- [ ] Backup retention policy enforced
- [ ] Sensitive exports have TTL and access controls

## F. Bangladesh UX And Compliance

- [ ] BDT formatting and Bangla copy reviewed on core customer journeys
- [ ] Bangladesh phone/address validation verified
- [ ] Privacy policy, refund policy, terms, and cookie consent live and linked
- [ ] Tax/invoice fields and legal footer content verified
- [ ] SMS/OTP fallback behavior tested for degraded provider conditions

## G. Release Strategy And Rollback

- [ ] Staging sign-off recorded
- [ ] Rollout plan defined (phased or canary)
- [ ] Rollback command and owner confirmed
- [ ] Post-deploy smoke checklist prepared
- [ ] Freeze window and communication plan aligned with support team

---

## Decision Rule

- **Go**: all boxes checked, or explicit written risk acceptance for any exception.
- **No-Go**: any unresolved critical security/payment/data-recovery gate.
