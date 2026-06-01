# API Route Inventory Summary

Audit date: 2026-05-10

Full discovered count: 148 `route.ts` files under `apps/web/app/api`.

## High-Risk Mutating Groups

- `/api/admin/*`
- `/api/agent/*`
- `/api/spots/checkout`
- `/api/stripe/*`
- `/api/intelligence/checkout`
- `/api/targeted/*`
- `/api/webhooks/*`
- `/api/facebook/*`
- `/api/nonprofit`
- `/api/waitlist`

## Read/Resolve Groups

- `/api/spots/resolve`
- `/api/spots/availability`
- `/api/admin/health`
- dashboard/API list routes

## Required Follow-Up

Generate a machine-readable full route manifest in the clean local git copy after removing OneDrive from the execution path. The manifest should include:

- route path
- file path
- HTTP methods
- auth type
- env vars
- tables touched
- external providers called
- mutation/read classification

