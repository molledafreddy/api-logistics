# OpenAPI Audit Report

_Generated: 2026-05-14T01:04:09.194Z_

## 📊 Summary

- Total operations: **198**
- With `summary`: 198 / 198 (100.0%)
- With `description`: 17 / 198 (8.6%)
- With `tags`: 198 / 198 (100.0%)
- With `security`: 191 / 198 (96.5%)
- With 2xx response: 198 / 198 (100.0%)

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
| Payments           | 2          |
| billing            | 2          |
| Audit              | 2          |
| Optimization       | 2          |
