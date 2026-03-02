# CoWork Space — API Documentation

**Base URL:** `http://localhost:5000/api/v1`
**Auth:** JWT via `Authorization: Bearer <token>` header **or** `token` cookie
**Content-Type:** `application/json` for all request bodies

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Coworking Spaces](#2-coworking-spaces)
3. [Reservations](#3-reservations)
4. [AI Recommendation](#4-ai-recommendation)
5. [Data Models](#5-data-models)
6. [Error Reference](#6-error-reference)

---

## 1. Authentication

### POST `/auth/register`

Register a new user account. Returns a JWT token on success.

**Access:** Public

**Request Body**

| Field      | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `name`     | string | Yes      | Display name                       |
| `tel`      | string | Yes      | 10-digit phone number              |
| `email`    | string | Yes      | Unique email address               |
| `password` | string | Yes      | Min 6 characters                   |
| `role`     | string | No       | `"user"` (default) or `"admin"`    |

**Example Request**
```json
POST /api/v1/auth/register
{
  "name": "Alice Smith",
  "tel": "0812345678",
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
The response also sets an `httpOnly` cookie named `token`.

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Missing fields, duplicate email, invalid tel/email format, password too short |

---

### POST `/auth/login`

Authenticate with email + password. Returns a JWT token.

**Access:** Public

**Request Body**

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | Yes      |
| `password` | string | Yes      |

**Example Request**
```json
POST /api/v1/auth/login
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Missing email or password; user not found |
| 401    | Wrong password |

---

### GET `/auth/me`

Return the profile of the currently authenticated user.

**Access:** Private (any authenticated user)

**Headers:** `Authorization: Bearer <token>`

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "Alice Smith",
    "tel": "0812345678",
    "email": "alice@example.com",
    "role": "user",
    "createdAt": "2025-01-15T08:00:00.000Z"
  }
}
```

---

### GET `/auth/logout`

Clear the auth cookie and log out.

**Access:** Private (any authenticated user)

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {}
}
```
Sets the `token` cookie to `"none"` expiring in 10 seconds.

---

## 2. Coworking Spaces

### GET `/coworkingSpaces`

List all coworking spaces with optional filtering, sorting, field selection, and pagination. Each space includes its associated reservations.

**Access:** Public

**Query Parameters**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `select`  | string | Comma-separated fields to return. e.g. `name,address` |
| `sort`    | string | Comma-separated fields to sort by. Prefix `-` for descending. e.g. `name` or `-createdAt` |
| `page`    | number | Page number (default: 1) |
| `limit`   | number | Results per page (default: 25) |
| `<field>` | any    | Filter by any model field. Supports operators: `gt`, `gte`, `lt`, `lte`, `in` |

**Filter Operator Syntax**

Append operator in brackets to the field name:
```
GET /api/v1/coworkingSpaces?opentime[lte]=10:00
```
This returns spaces that open at or before 10:00.

**Example Requests**
```
GET /api/v1/coworkingSpaces
GET /api/v1/coworkingSpaces?select=name,address&sort=name&page=1&limit=10
GET /api/v1/coworkingSpaces?name=TechHub
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "count": 2,
  "pagination": {
    "next": { "page": 2, "limit": 25 }
  },
  "data": [
    {
      "_id": "664b0000000000000000001",
      "name": "TechHub BKK",
      "address": "123 Silom Rd, Bangkok",
      "tel": "021234567",
      "opentime": "08:00",
      "closetime": "20:00",
      "reservations": []
    }
  ]
}
```

---

### GET `/coworkingSpaces/:id`

Get a single coworking space by its ID.

**Access:** Public

**URL Params:** `id` — MongoDB ObjectId of the space

**Example Request**
```
GET /api/v1/coworkingSpaces/664b0000000000000000001
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664b0000000000000000001",
    "name": "TechHub BKK",
    "address": "123 Silom Rd, Bangkok",
    "tel": "021234567",
    "opentime": "08:00",
    "closetime": "20:00"
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Space not found |

---

### POST `/coworkingSpaces`

Create a new coworking space.

**Access:** Private — **admin only**

**Request Body**

| Field       | Type   | Required | Constraints              |
|-------------|--------|----------|--------------------------|
| `name`      | string | Yes      | Unique, max 50 chars     |
| `address`   | string | Yes      |                          |
| `tel`       | string | Yes      |                          |
| `opentime`  | string | Yes      | Format `HH:MM` e.g. `08:00` |
| `closetime` | string | Yes      | Format `HH:MM` e.g. `20:00` |

**Example Request**
```json
POST /api/v1/coworkingSpaces
Authorization: Bearer <admin_token>

{
  "name": "TechHub BKK",
  "address": "123 Silom Rd, Bangkok",
  "tel": "021234567",
  "opentime": "08:00",
  "closetime": "20:00"
}
```

**Example Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "_id": "664b0000000000000000001",
    "name": "TechHub BKK",
    "address": "123 Silom Rd, Bangkok",
    "tel": "021234567",
    "opentime": "08:00",
    "closetime": "20:00"
  }
}
```

---

### PUT `/coworkingSpaces/:id`

Update an existing coworking space. Only send the fields you want to change.

**Access:** Private — **admin only**

**URL Params:** `id` — MongoDB ObjectId

**Example Request**
```json
PUT /api/v1/coworkingSpaces/664b0000000000000000001
Authorization: Bearer <admin_token>

{
  "closetime": "22:00"
}
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664b0000000000000000001",
    "name": "TechHub BKK",
    "opentime": "08:00",
    "closetime": "22:00"
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Space not found or validation error |

---

### DELETE `/coworkingSpaces/:id`

Permanently delete a coworking space and **all its associated reservations**.

**Access:** Private — **admin only**

**URL Params:** `id` — MongoDB ObjectId

**Example Request**
```
DELETE /api/v1/coworkingSpaces/664b0000000000000000001
Authorization: Bearer <admin_token>
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {}
}
```

> **Warning:** This is a cascading delete. All reservations linked to this space are also permanently removed.

---

## 3. Reservations

Reservations can be accessed via two base paths:

| Path | Context |
|------|---------|
| `/api/v1/reservations` | Global — used for GET all, GET one, PUT, DELETE |
| `/api/v1/coworkingSpaces/:coworkingSpaceId/reservations` | Scoped — required for POST (create) |

---

### GET `/reservations/public/:id`

Fetch a reservation's details without authentication. Intended for QR code scanning at check-in.

**Access:** Public

**URL Params:** `id` — Reservation ObjectId

**Example Request**
```
GET /api/v1/reservations/public/664c0000000000000000010
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664c0000000000000000010",
    "apptDate": "2025-06-01T03:00:00.000Z",
    "apptEnd": "2025-06-01T05:00:00.000Z",
    "qrCode": "data:image/png;base64,...",
    "coworkingSpace": {
      "_id": "664b0000000000000000001",
      "name": "TechHub BKK",
      "address": "123 Silom Rd, Bangkok",
      "tel": "021234567",
      "opentime": "08:00",
      "closetime": "20:00"
    },
    "user": {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "name": "Alice Smith",
      "tel": "0812345678",
      "email": "alice@example.com"
    }
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 404    | Reservation not found |
| 500    | Server error |

---

### GET `/reservations`

Get all reservations.

- **Admin:** sees all reservations across all users and spaces.
- **Regular user:** sees only their own reservations.

**Access:** Private (admin or user)

**Query Parameters**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `page`    | number | Page number (default: 1) |
| `limit`   | number | Results per page (default: 25) |

**Example Request**
```
GET /api/v1/reservations
Authorization: Bearer <token>
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "count": 1,
  "pagination": {},
  "data": [
    {
      "_id": "664c0000000000000000010",
      "apptDate": "2025-06-01T03:00:00.000Z",
      "apptEnd": "2025-06-01T05:00:00.000Z",
      "createdAt": "2025-05-20T10:00:00.000Z",
      "qrCode": "data:image/png;base64,...",
      "coworkingSpace": {
        "_id": "664b0000000000000000001",
        "name": "TechHub BKK",
        "address": "123 Silom Rd, Bangkok",
        "tel": "021234567",
        "opentime": "08:00",
        "closetime": "20:00"
      }
    }
  ]
}
```

---

### GET `/reservations/:id`

Get a single reservation by ID.

- Users can only view their own reservations.
- Admins can view any reservation.

**Access:** Private (admin or user)

**URL Params:** `id` — Reservation ObjectId

**Example Request**
```
GET /api/v1/reservations/664c0000000000000000010
Authorization: Bearer <token>
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664c0000000000000000010",
    "apptDate": "2025-06-01T03:00:00.000Z",
    "apptEnd": "2025-06-01T05:00:00.000Z",
    "user": "664a1b2c3d4e5f6a7b8c9d0e",
    "coworkingSpace": {
      "name": "TechHub BKK",
      "address": "123 Silom Rd, Bangkok",
      "opentime": "08:00",
      "closetime": "20:00"
    }
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 403    | Authenticated user does not own this reservation |
| 404    | Reservation not found |

---

### POST `/coworkingSpaces/:coworkingSpaceId/reservations`

Create a new reservation at a specific coworking space.

**Access:** Private (admin or user)

**URL Params:** `coworkingSpaceId` — ObjectId of the target space

**Request Body**

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `apptDate` | string | Yes      | ISO 8601 datetime — must be a future, on-the-hour time within operating hours |
| `apptEnd`  | string | No       | ISO 8601 datetime — defaults to 60 min after `apptDate` if omitted |

**Business Rules**

| Rule | Detail |
|------|--------|
| Future only | `apptDate` must be after current time |
| On-the-hour | Both `apptDate` and `apptEnd` must have `:00` minutes and `:00` seconds |
| Operating hours | Both times must fall within the space's `opentime`–`closetime` (Asia/Bangkok timezone) |
| End after start | `apptEnd` must be strictly after `apptDate` |
| No overlap | Must not overlap with any of your existing reservations at the same space |
| 3-reservation cap | Regular users may hold at most 3 future reservations at any time |

**Side Effects**
- A QR code (`data:image/png;base64,…`) is generated and stored on the reservation.
- A confirmation email (with QR code attachment) is sent to the user's email address.

**Example Request**
```json
POST /api/v1/coworkingSpaces/664b0000000000000000001/reservations
Authorization: Bearer <token>

{
  "apptDate": "2025-06-01T03:00:00.000Z",
  "apptEnd": "2025-06-01T05:00:00.000Z"
}
```
> `2025-06-01T03:00:00.000Z` = 10:00 Bangkok time (UTC+7). Ensure times align with Bangkok timezone.

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664c0000000000000000010",
    "apptDate": "2025-06-01T03:00:00.000Z",
    "apptEnd": "2025-06-01T05:00:00.000Z",
    "user": "664a1b2c3d4e5f6a7b8c9d0e",
    "coworkingSpace": "664b0000000000000000001",
    "qrCode": "data:image/png;base64,...",
    "createdAt": "2025-05-20T10:00:00.000Z"
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Invalid/past date; not on the hour; outside operating hours; end before start; overlapping reservation; 3-reservation cap exceeded |
| 404    | Coworking space not found |
| 500    | Server error |

---

### PUT `/reservations/:id`

Update the date/time of an existing reservation.

- Users can only update their own reservations.
- Admins can update any reservation and are exempt from the 1-hour deadline rule.

**Access:** Private (admin or user)

**URL Params:** `id` — Reservation ObjectId

**Request Body** — at least one field required

| Field      | Type   | Description |
|------------|--------|-------------|
| `apptDate` | string | New start datetime (ISO 8601) |
| `apptEnd`  | string | New end datetime (ISO 8601) |

If only `apptDate` is provided, `apptEnd` shifts by the same duration as the original booking.

**Business Rules** — same as creation plus:

| Rule | Detail |
|------|--------|
| 1-hour deadline | Regular users cannot modify within 1 hour of the booked start time |

**Example Request**
```json
PUT /api/v1/reservations/664c0000000000000000010
Authorization: Bearer <token>

{
  "apptDate": "2025-06-02T04:00:00.000Z",
  "apptEnd": "2025-06-02T06:00:00.000Z"
}
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "664c0000000000000000010",
    "apptDate": "2025-06-02T04:00:00.000Z",
    "apptEnd": "2025-06-02T06:00:00.000Z"
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | No fields provided; within 1-hour deadline; date validation failures; overlap |
| 403    | User does not own this reservation |
| 404    | Reservation or coworking space not found |

---

### DELETE `/reservations/:id`

Cancel (permanently delete) a reservation.

- Users can only delete their own reservations.
- Admins can delete any reservation and are exempt from the 1-hour deadline rule.

**Access:** Private (admin or user)

**URL Params:** `id` — Reservation ObjectId

**Business Rules**

| Rule | Detail |
|------|--------|
| 1-hour deadline | Regular users cannot cancel within 1 hour of the booked start time |

**Example Request**
```
DELETE /api/v1/reservations/664c0000000000000000010
Authorization: Bearer <token>
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {}
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 400    | Within 1-hour deadline |
| 403    | User does not own this reservation |
| 404    | Reservation not found |

---

## 4. AI Recommendation

### POST `/recommend`

Get an AI-powered coworking space recommendation based on the user's booking history.

**Access:** Private (any authenticated user)

The endpoint:
1. Fetches the user's 10 most recent reservations.
2. Fetches all available coworking spaces.
3. Sends both to an LLM (via OpenRouter) and returns a structured recommendation.

**Request Body:** Empty — no body required.

**Example Request**
```
POST /api/v1/recommend
Authorization: Bearer <token>
```

**Example Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommended": "TechHub BKK",
    "reason": "You've visited TechHub BKK most frequently and it matches your preferred morning hours.",
    "alternativeSpaces": ["Creative Lab Thonglor", "The Hive Ekkamai"]
  }
}
```

**Errors**

| Status | Cause |
|--------|-------|
| 502    | AI service (OpenRouter) returned an error |
| 500    | Server error |

---

## 5. Data Models

### User

| Field       | Type   | Notes |
|-------------|--------|-------|
| `_id`       | ObjectId | Auto-generated |
| `name`      | string | Required |
| `tel`       | string | Required, 10 digits |
| `email`     | string | Required, unique |
| `role`      | string | `"user"` (default) or `"admin"` |
| `password`  | string | bcrypt-hashed, never returned in responses |
| `createdAt` | Date   | Auto-set |

### CoworkingSpace

| Field       | Type   | Notes |
|-------------|--------|-------|
| `_id`       | ObjectId | Auto-generated |
| `name`      | string | Required, unique, max 50 chars |
| `address`   | string | Required |
| `tel`       | string | Required |
| `opentime`  | string | Required, format `HH:MM` |
| `closetime` | string | Required, format `HH:MM` |
| `reservations` | virtual | Populated on GET all |

### Reservation

| Field          | Type     | Notes |
|----------------|----------|-------|
| `_id`          | ObjectId | Auto-generated |
| `apptDate`     | Date     | Required — start of booking |
| `apptEnd`      | Date     | Required — end of booking |
| `user`         | ObjectId | Ref: User |
| `coworkingSpace` | ObjectId | Ref: CoworkingSpace |
| `qrCode`       | string   | Base64 data URI, generated on creation |
| `createdAt`    | Date     | Auto-set |

---

## 6. Error Reference

All error responses follow this shape:

```json
{
  "success": false,
  "message": "Human-readable description"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 200         | OK |
| 201         | Created |
| 400         | Bad request — validation or business rule violation |
| 401         | Unauthorized — wrong credentials |
| 403         | Forbidden — authenticated but not allowed |
| 404         | Resource not found |
| 500         | Internal server error |
| 502         | Bad gateway — upstream AI service error |

---

## Quick Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register |
| POST | `/auth/login` | Public | Login |
| GET | `/auth/me` | User | Get my profile |
| GET | `/auth/logout` | User | Logout |
| GET | `/coworkingSpaces` | Public | List all spaces |
| GET | `/coworkingSpaces/:id` | Public | Get one space |
| POST | `/coworkingSpaces` | Admin | Create space |
| PUT | `/coworkingSpaces/:id` | Admin | Update space |
| DELETE | `/coworkingSpaces/:id` | Admin | Delete space + reservations |
| GET | `/reservations/public/:id` | Public | Get reservation (QR scan) |
| GET | `/reservations` | User/Admin | List reservations |
| GET | `/reservations/:id` | User/Admin | Get one reservation |
| POST | `/coworkingSpaces/:spaceId/reservations` | User/Admin | Create reservation |
| PUT | `/reservations/:id` | User/Admin | Update reservation |
| DELETE | `/reservations/:id` | User/Admin | Cancel reservation |
| POST | `/recommend` | User/Admin | AI space recommendation |
