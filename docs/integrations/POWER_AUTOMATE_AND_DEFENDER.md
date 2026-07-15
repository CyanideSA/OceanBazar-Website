# Power Automate (Free) + Defender for Office 365 — Setup Guide

## Power Automate Free (standard connectors)

Your **Power Automate Free** license supports **standard connectors only**. It cannot call the OceanBazar custom API (that requires the premium HTTP connector). Use these patterns instead:

### Flow 1: New mail in support@ → Teams alert
1. Trigger: **When a new email arrives (V3)** — shared mailbox `support@oceanbazar.com` or `support@oceanbazar.com.bd`
2. Action: **Post message in a chat or channel** (Teams) — notify the support channel with subject + sender

### Flow 2: New mail in sales@ → SharePoint list
1. Trigger: **When a new email arrives** — `sales@oceanbazar.com.bd`
2. Action: **Create item** (SharePoint) — log lead inquiries for follow-up

### Flow 3: Microsoft Forms → approval
1. Trigger: **When a new response is submitted** (Forms)
2. Action: **Start and wait for an approval** — wholesale/partner applications

### OceanBazar → Teams (built-in)
OceanBazar posts Adaptive Cards to `TEAMS_WEBHOOK_URL` for:
- New orders
- New support tickets
- Refund/return requests
- Low stock alerts

Configure a Teams **Incoming Webhook** or **Workflows** URL and set `TEAMS_WEBHOOK_URL` in the BFF environment.

---

## Defender for Office 365 Plan 1

Defender does not expose a CRM API. Configure these policies in **Microsoft 365 Defender portal** for your shared mailboxes:

| Policy | Recommendation |
|--------|----------------|
| **Safe Links** | Enable for all users + shared mailboxes |
| **Safe Attachments** | Dynamic delivery for inbound attachments |
| **Anti-phishing** | Impersonation protection for `oceanbazar.com.bd` / `oceanbazar.com` domains |
| **Quarantine** | Review weekly; do not auto-release suspicious mail to CRM inboxes |

### Mailboxes to protect
- User mailboxes: `nishad@`, `akand@`, `md-jobayer@`, `suvo-ahmed@` @oceanbazar.com.bd
- Shared: `sales@`, `support@`, `no-reply@`, `admin@` @oceanbazar.com.bd / .com

This protects the Outlook-style CRM mail UI when admins read/send from shared mailboxes via Microsoft Graph.
