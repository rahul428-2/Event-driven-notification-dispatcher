# Event-Driven Notification Dispatcher

A lightweight event-driven notification dispatcher built with **Node.js**, **Express.js**, and **SQLite**. The application accepts business events, stores them in a relational database, queues notification tasks, and processes them asynchronously using a native in-memory queue.

---

# Project Overview

This project demonstrates an event-driven architecture where API requests are acknowledged immediately while notification processing happens asynchronously in the background.

When a client submits an event:

1. The request is validated.
2. The event is stored in SQLite.
3. A pending notification is created.
4. The notification is pushed into an in-memory queue.
5. The API immediately responds with **HTTP 202 Accepted**.
6. A background worker processes the notification independently.

This approach keeps API response times low while separating request handling from background processing.

---

# Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (`better-sqlite3`)
- **Queue:** Native JavaScript In-Memory Queue
- **Architecture:** Event-Driven Asynchronous Processing

---

# Project Structure

```text
project-root/
│
├── src/
│   ├── app.js
│   ├── server.js
│   ├── controllers/
│   │   └── eventController.js
│   ├── services/
│   │   ├── eventService.js
│   │   ├── notificationService.js
│   │   └── queueWorker.js
│   ├── db/
│   │   ├── database.js
│   │   └── schema.sql
│   └── routes/
│       └── eventRoutes.js
│
├── architecture-diagram.png
├── README.md
├── package.json
├── .env.example
└── .gitignore
```

---

# Installation

Clone the repository.

```bash
git clone <repository-url>
cd Event-driven-notification-dispatcher
```

Install dependencies.

```bash
npm install
```

Create an environment file.

```bash
cp .env.example .env
```

---

# Environment Variables

Example:

```env
PORT=3000
DATABASE_PATH=data/notifications.db
```

---

# Running the Application

Development mode

```bash
npm run dev
```

Production mode

```bash
npm start
```

The application automatically:

- Creates the SQLite database.
- Creates the required tables.
- Starts the background queue worker.
- Listens for incoming API requests.

---

# Database Schema

## events

| Column | Type |
|---------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| event_type | TEXT |
| payload | TEXT |
| created_at | DATETIME |

---

## notifications

| Column | Type |
|---------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| event_id | INTEGER |
| recipient | TEXT |
| channel | TEXT |
| status | pending / completed / failed |
| retry_count | INTEGER |
| created_at | DATETIME |
| updated_at | DATETIME |

The notification table maintains a foreign key relationship with the events table.

---

# API

## POST /api/v1/events

Registers a business event and queues a notification.

### Request

```http
POST /api/v1/events
Content-Type: application/json
```

### Request Body

```json
{
    "event_type":"order_placed",
    "recipient":"user@example.com",
    "data":{
        "order_id":101
    }
}
```

---

## Success Response

HTTP Status

```text
202 Accepted
```

Body

```json
{
    "message":"Event accepted for processing",
    "tracking_id":1,
    "notification_id":1,
    "status":"pending"
}
```

---

## Validation Error

HTTP Status

```text
400 Bad Request
```

```json
{
    "error":"event_type and recipient are required"
}
```

---

## Invalid JSON

HTTP Status

```text
400 Bad Request
```

```json
{
    "error":"Invalid JSON payload"
}
```

---

## Internal Server Error

HTTP Status

```text
500 Internal Server Error
```

```json
{
    "error":"Internal server error"
}
```

---

# Example Request

```bash
curl -X POST http://localhost:3000/api/v1/events \
-H "Content-Type: application/json" \
-d '{
  "event_type":"order_placed",
  "recipient":"user@example.com",
  "data":{
      "order_id":101
  }
}'
```

---

# Queue Processing

The application uses a native FIFO in-memory queue.

Processing flow:

```text
Client
      │
      ▼
POST /api/v1/events
      │
      ▼
Validate Request
      │
      ▼
Store Event
      │
      ▼
Create Pending Notification
      │
      ▼
Push Task Into Queue
      │
      ▼
Return HTTP 202 Immediately
──────────────────────────────────────
Background Worker
      │
      ▼
Random Delay (500–1000 ms)
      │
      ▼
10% Failure Simulation
      │
      ▼
Update Notification Status
```

The worker processes notifications independently of the HTTP request lifecycle.

---

# Notification Processing

Each queued notification:

- waits for a random delay between **500 ms** and **1000 ms**
- has a **10% simulated failure rate**
- updates the notification status to:
  - `completed`
  - `failed`
- increments `retry_count` when processing fails

---

# Error Handling

The application gracefully handles:

- Missing `event_type`
- Missing `recipient`
- Invalid JSON payloads
- Database failures
- Notification update failures
- Queue processing failures
- Unexpected server exceptions

---

# Assumptions

- Notification channel is always `email`.
- Notification sending is simulated.
- Queue is intentionally implemented in memory.
- One worker processes one notification at a time.

---

# Limitations

- The queue exists only in memory.
- Pending tasks are lost if the server stops before processing them.
- The system is designed for a single application instance.
- Failed notifications are marked as failed but are not automatically retried.

---

# Architecture

The complete system architecture is available in:

```
architecture-diagram.png
```

---

# Design Decisions

This implementation intentionally uses:

- Native JavaScript queue
- SQLite
- Express.js
- Background worker loop

No external queue systems (Redis, RabbitMQ, Kafka, BullMQ) are used, matching the assessment requirements.

---

# Author

**Rahul**
