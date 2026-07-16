# Integration callback configuration

All payment and courier callback URLs terminate at the public Node BFF. Do not
configure a Java API URL for these integrations.

## SSLCommerz

Set `API_BASE_URL=https://api.oceanbazar.com.bd`. The BFF supplies:

- Success: `https://api.oceanbazar.com.bd/api/payments/sslcommerz/success`
- Failure: `https://api.oceanbazar.com.bd/api/payments/sslcommerz/fail`
- Cancellation: `https://api.oceanbazar.com.bd/api/payments/sslcommerz/cancel`
- IPN: `https://api.oceanbazar.com.bd/api/payments/sslcommerz/ipn`

IPN requires a publicly reachable HTTPS URL. Loopback callback URLs are suitable
only for browser-return testing and cannot receive server-to-server IPNs.

## Steadfast

- Callback URL: `https://api.oceanbazar.com.bd/api/webhooks/steadfast`
- Header: `Authorization: Bearer <STEADFAST_WEBHOOK_TOKEN>`
- Content type: `application/json`

Use the same randomly generated token in the Steadfast webhook configuration and
the BFF secret store. The endpoint rejects missing or invalid bearer tokens.

## Meta and WhatsApp

- Callback URL: `https://api.oceanbazar.com.bd/api/webhooks/meta`
- Verify token: the value stored as `META_VERIFY_TOKEN`

Subscribe the Meta app to the required Page, Instagram and
`whatsapp_business_account` webhook fields. POST payloads are verified with the
`X-Hub-Signature-256` signature when `META_APP_SECRET` is configured.

The admin OAuth redirect URI must exactly match
`META_OAUTH_REDIRECT_URI` and its hostname must be present in
`META_OAUTH_ALLOWED_HOSTS`.
