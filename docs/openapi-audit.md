# OpenAPI Audit Report

_Generated: 2026-06-17T03:37:43.246Z_

## 📊 Summary

- Total operations: **223**
- With `summary`: 223 / 223 (100.0%)
- With `description`: 20 / 223 (9.0%)
- With `tags`: 223 / 223 (100.0%)
- With `security`: 216 / 223 (96.9%)
- With 2xx response: 223 / 223 (100.0%)

- 🔴 Errors: **0**
- 🟡 Warnings: **3**

## 🔍 Findings by rule

### 🟡 `inline-body-schema` — 3 occurrences

| Method  | Path                                  | Detail                                                 |
| ------- | ------------------------------------- | ------------------------------------------------------ |
| `PATCH` | `/api/v1/plans/{id}/price`            | Request body uses inline schema (prefer DTO with $ref) |
| `PATCH` | `/api/v1/plans/{id}/limits`           | Request body uses inline schema (prefer DTO with $ref) |
| `POST`  | `/api/v1/payments/{provider}/webhook` | Request body uses inline schema (prefer DTO with $ref) |

## 🏷️ Operations per tag

| Tag                | Operations |
| ------------------ | ---------- |
| Plans              | 20         |
| DeliveryRuns       | 16         |
| Shipments          | 14         |
| Verifications      | 12         |
| Chat               | 12         |
| Subscriptions      | 11         |
| Auth               | 9          |
| Trucks             | 9          |
| Drivers            | 9          |
| Expenses           | 9          |
| Users (Team)       | 8          |
| Routes             | 8          |
| RecurringTemplates | 8          |
| Referrals          | 7          |
| Relationships      | 6          |
| Admin              | 6          |
| Tracking           | 6          |
| Dashboard          | 6          |
| Companies          | 5          |
| Payments           | 5          |
| Notifications      | 5          |
| Files              | 5          |
| Saved Addresses    | 5          |
| Health             | 4          |
| billing            | 4          |
| Reports            | 4          |
| Geocoding          | 3          |
| Audit              | 2          |
| Optimization       | 2          |
| ReferralsLanding   | 1          |
| Public Tracking    | 1          |
| TrackingPage       | 1          |
