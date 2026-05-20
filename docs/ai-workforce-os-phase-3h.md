# AI Workforce OS Phase 3H: Action Center Source Health

## What changed

Phase 3H surfaces unavailable Action Center sources directly in the existing AI Agents dashboard.

Admins now see:

- Which Action Center sources are unavailable
- Why a source failed when the system has a reason
- A clear warning that the queue may be incomplete until the source recovers

## Why it matters

The Action Center is becoming the shared operating queue for AI Workforce, outreach, procurement, political, Gov Contracts, payments, and system reliability. Source health needs to be visible so admins know whether the queue is complete before relying on it operationally.

## Safety

This phase only displays existing `sourceHealth` information already returned by the Action Center service. It does not add external execution, alter data, or change any customer-facing workflow.
