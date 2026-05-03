# OpenAPI Audit Report

_Generated: 2026-05-03T19:51:17.776Z_

## 📊 Summary

- Total operations: **194**
- With `summary`: 194 / 194 (100.0%)
- With `description`: 13 / 194 (6.7%)
- With `tags`: 194 / 194 (100.0%)
- With `security`: 187 / 194 (96.4%)
- With 2xx response: 194 / 194 (100.0%)

- 🔴 Errors: **0**
- 🟡 Warnings: **2**

## 🔍 Findings by rule

### 🟡 `inline-body-schema` — 2 occurrences

| Method  | Path                        | Detail                                                 |
| ------- | --------------------------- | ------------------------------------------------------ |
| `PATCH` | `/api/v1/plans/{id}/price`  | Request body uses inline schema (prefer DTO with $ref) |
| `PATCH` | `/api/v1/plans/{id}/limits` | Request body uses inline schema (prefer DTO with $ref) |

## 🏷️ Operations per tag

| Tag                | Operations |
| ------------------ | ---------- |
| Plans              | 19         |
| Shipments          | 14         |
| DeliveryRuns       | 13         |
| Verifications      | 12         |
| Subscriptions      | 11         |
| Chat               | 11         |
| Trucks             | 9          |
| Expenses           | 9          |
| Users (Team)       | 8          |
| Drivers            | 8          |
| Routes             | 8          |
| RecurringTemplates | 8          |
| Auth               | 7          |
| Relationships      | 6          |
| Admin              | 6          |
| Tracking           | 6          |
| Dashboard          | 6          |
| Companies          | 5          |
| Notifications      | 5          |
| Saved Addresses    | 5          |
| Health             | 4          |
| Reports            | 4          |
| Files              | 3          |
| Geocoding          | 3          |
| Audit              | 2          |
| Optimization       | 2          |
