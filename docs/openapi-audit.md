# OpenAPI Audit Report

_Generated: 2026-06-06T03:02:09.344Z_

## 📊 Summary

- Total operations: **219**
- With `summary`: 217 / 219 (99.1%)
- With `description`: 20 / 219 (9.1%)
- With `tags`: 219 / 219 (100.0%)
- With `security`: 212 / 219 (96.8%)
- With 2xx response: 219 / 219 (100.0%)

- 🔴 Errors: **2**
- 🟡 Warnings: **3**

## 🔍 Findings by rule

### 🟡 `inline-body-schema` — 3 occurrences

| Method  | Path                                  | Detail                                                 |
| ------- | ------------------------------------- | ------------------------------------------------------ |
| `PATCH` | `/api/v1/plans/{id}/price`            | Request body uses inline schema (prefer DTO with $ref) |
| `PATCH` | `/api/v1/plans/{id}/limits`           | Request body uses inline schema (prefer DTO with $ref) |
| `POST`  | `/api/v1/payments/{provider}/webhook` | Request body uses inline schema (prefer DTO with $ref) |

### 🔴 `missing-summary` — 2 occurrences

| Method | Path                             | Detail                                 |
| ------ | -------------------------------- | -------------------------------------- |
| `GET`  | `/api/v1/referrals/join/{token}` | No @ApiOperation({ summary }) declared |
| `GET`  | `/api/v1/tracking/{token}`       | No @ApiOperation({ summary }) declared |

## 🏷️ Operations per tag

| Tag                | Operations |
| ------------------ | ---------- |
| Plans              | 20         |
| DeliveryRuns       | 16         |
| Shipments          | 14         |
| Verifications      | 12         |
| Subscriptions      | 11         |
| Chat               | 11         |
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
| Notifications      | 5          |
| Files              | 5          |
| Saved Addresses    | 5          |
| Health             | 4          |
| billing            | 4          |
| Reports            | 4          |
| Geocoding          | 3          |
| Payments           | 2          |
| Audit              | 2          |
| Optimization       | 2          |
| ReferralsLanding   | 1          |
| Public Tracking    | 1          |
| TrackingPage       | 1          |
