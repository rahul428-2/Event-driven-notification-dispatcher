# Event-Driven Notification Dispatcher

A lightweight event-driven notification dispatcher built using **Node.js**, **Express.js**, and **SQLite** (`better-sqlite3`). The system is designed to accept incoming business events, immediately record them to a relational database, trigger corresponding notification tasks with a default channel, queue those tasks, and process them asynchronously in the background using a native in-memory worker loop.

By decoupling HTTP request ingestion from notification sending, the API maintains exceptionally low latencies (returning a response in single-digit milliseconds) while ensuring notifications are processed reliably in a separate execution flow.

---

## Project Overview

This project demonstrates a standard event-driven architectural pattern where request processing is split into synchronous validation/ingestion and asynchronous background dispatching.

```
Client                    Express API                  SQLite DB                 In-Memory Queue          Background Worker
  │                            │                           │                           │                          │
  │─── POST /api/v1/events ───>│                           │                           │                          │
  │                            │─── 1. Write Event ───────>│                           │                          │
  │                            │─── 2. Write Pending ─────>│                           │                          │
  │                            │                                                       │                          │
  │                            │─── 3. Enqueue Task ──────────────────────────────────>│                          │
  │                            │                                                       │                          │
  │<── HTTP 202 Accepted ──────│                                                       │                          │
  │    (Immediate Response)    │                                                       │                          │
  │                            │                                                       │                          │
  │                            │                                                       │─── Pull next task ──────>│
  │                            │                                                       │                          │
  │                            │                                                       │                          │─── 4. Wait 500-1000ms ───
  │                            │                                                       │                          │
  │                            │                                                       │                          │─── 5. Roll 10% error ────
  │                            │                                                       │                          │
  │                            │<── 6. Update Status (Completed or Failed) ────────────┼──────────────────────────│
```

---

## Tech Stack

* **Runtime:** Node.js (v20+)
* **API Framework:** Express.js
* **Database Engine:** SQLite (driven via `better-sqlite3` for high-performance synchronous operations on the main thread)
* **Asynchronous Queue:** Native JavaScript array-based FIFO queue with an async polling worker loop
* **Process Monitor:** Nodemon (for development hot-reloading)

---

## Project Structure

The codebase is organized following clean-architecture principles, separating routing, controllers, services, database storage, and worker logic:

```text
project-root/
├── src/
│   ├── app.js                 # Configures Express application, middleware, and error boundaries
│   ├── server.js              # Entry point: loads environment variables, starts HTTP server and queue worker
│   ├── controllers/
│   │   └── eventController.js # Handles API request parsing, payload validation, and HTTP responses
│   ├── services/
│   │   ├── eventService.js    # Coordinates database transactions (saving events/notifications) and enqueuing tasks
│   │   ├── notificationService.js # Simulates third-party delivery dispatch (delays and failures)
│   │   └── queueWorker.js     # Continuous background worker that pulls and processes tasks from the queue
│   ├── db/
│   │   ├── database.js        # Initializes SQLite database connections and runs table creation schemas
│   │   └── schema.sql         # Relational database table layout and constraints DDL
│   └── routes/
│       └── eventRoutes.js     # Maps POST endpoints to their respective controller handlers
│
├── architecture-diagram.png   # System architecture diagram tracing the event pipeline
├── package.json               # Node.js project manifest, dependencies, and execution scripts
├── README.md                  # Comprehensive documentation and setup guides
├── .env.example               # Template environment configuration file
└── .gitignore                 # Files and folders ignored from git version control
```

---

## Component Walkthrough

### 1. Ingestion Layer (`src/app.js` & `src/server.js`)
- `app.js` configures the Express middleware pipeline, mounting standard JSON parsers and routing definitions. It installs a global syntax error handler to catch malformed payloads (returning HTTP 400) and an unhandled exception interceptor (returning HTTP 500) to keep the server robust.
- `server.js` starts the background `queueWorker` loop and binds the HTTP server to the designated port.

### 2. Validation & Routing (`src/routes/` & `src/controllers/`)
- `eventRoutes.js` mounts endpoints under the versioned path `/api/v1/events`.
- `eventController.js` validates that required fields `event_type` and `recipient` are present in the JSON body. If validation fails, it stops processing and immediately returns `400 Bad Request`.

### 3. Business logic & Transaction Layer (`src/services/eventService.js`)
- Integrates database writes inside an atomic SQLite transaction. This guarantees that an event is never created without its corresponding notification task (or vice versa).
- Pushes the created task object onto the in-memory queue.

### 4. Background Queue Worker (`src/services/queueWorker.js` & `src/services/notificationService.js`)
- Runs a continuous `while (true)` loop. If tasks exist, they are pulled using `shift()` (FIFO). If the queue is empty, the loop yields the thread back to Node's event loop via a short promise-based timeout (100ms) to prevent high CPU utilization.
- Executes database status writes inside a double-wrapped try-catch block, protecting the worker loop from crashing if SQLite experiences temporary lock-ups.

---

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Event-driven-notification-dispatcher
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment File
```bash
cp .env.example .env
```

---

## Environment Variables

Configure the server port and database file location inside your `.env` file:

```env
PORT=3000
DB_PATH=data/notifications.db
```

---

## Running the Application

### Development Mode (Auto-reload on code change)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Upon boot, the application automatically:
1. Verifies if the parent directory for the SQLite database exists (creating it recursively if it does not).
2. Connects to `notifications.db`.
3. Reads and runs `src/db/schema.sql` to initialize the database tables if they do not exist.
4. Starts the background queue worker.
5. Listens for incoming HTTP traffic.

---

## Database Schema

The SQLite schema utilizes two tables linked via a foreign key constraint:

### 1. `events` Table
Stores raw client events.
* `id` (INTEGER, Primary Key, Autoincrement)
* `event_type` (TEXT, Not Null): E.g., `order_placed`
* `payload` (TEXT, Not Null): JSON payload string containing event data details
* `created_at` (DATETIME, Default Current Timestamp)

### 2. `notifications` Table
Stores notification tasks and status states.
* `id` (INTEGER, Primary Key, Autoincrement)
* `event_id` (INTEGER, Not Null, Foreign Key referencing `events.id`)
* `recipient` (TEXT, Not Null): Email address of the recipient
* `channel` (TEXT, Not Null): Delivery channel (Defaults to `email`)
* `status` (TEXT, Not Null, Checked): State restriction (`pending`, `completed`, `failed`)
* `retry_count` (INTEGER, Default 0): Increments on delivery failures
* `created_at` (DATETIME, Default Current Timestamp)
* `updated_at` (DATETIME, Default Current Timestamp)

---

## API Documentation

### Register Business Event
* **URL:** `/api/v1/events`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "event_type": "order_placed",
  "recipient": "user@example.com",
  "data": {
    "order_id": 101
  }
}
```

#### Success Response (HTTP 202 Accepted)
```json
{
  "message": "Event accepted for processing",
  "tracking_id": 1,
  "notification_id": 1,
  "status": "pending"
}
```

#### Missing Input Error (HTTP 400 Bad Request)
```json
{
  "error": "event_type and recipient are required"
}
```

#### Invalid JSON Error (HTTP 400 Bad Request)
```json
{
  "error": "Invalid JSON payload"
}
```

#### Unexpected Server Error (HTTP 500 Internal Server Error)
```json
{
  "error": "Internal server error"
}
```

---

## Testing locally

You can test the ingestion endpoint and verify background updates using `curl`:

```bash
curl -i -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_placed",
    "recipient": "user@example.com",
    "data": {
      "order_id": 101
    }
  }'
```

---

## Queue & Processing Mechanics

1. **Queue Store**: A simple JavaScript Array (`this.queue = []`) provides First-In-First-Out (FIFO) queue ordering.
2. **Asynchronous Dispatch**: The HTTP lifecycle terminates and returns `202 Accepted` immediately after pushing a task to the queue array.
3. **Simulated Delays**: The worker simulates delivery network latency using a random timeout generator:
   ```javascript
   const delay = Math.floor(Math.random() * 501) + 500; // Generates 500ms - 1000ms delay
   ```
4. **Simulated Failures**: A 10% failure threshold is evaluated using `Math.random() < 0.1`.
   * **Success Outcome**: Database updates status to `completed` and sets `updated_at = CURRENT_TIMESTAMP`.
   * **Failure Outcome**: Database updates status to `failed`, increments `retry_count` by 1, and sets `updated_at = CURRENT_TIMESTAMP`.

---

## Assumptions & Limitations

### Assumptions
* The default communication channel is `email` for all notification tasks.
* External API gateway endpoints are simulated via Promise-based timeouts.
* Only one background worker loop processes tasks sequentially from the queue.

### Limitations
* **Memory Volatility**: The queue resides in the application's RAM. If the server process crashes or restarts, any pending queue tasks that have not yet been processed by the worker will be lost (though their status remains stored as `pending` in the SQLite database).
* **Single-Instance Restriction**: Because the queue is in-memory, the dispatcher cannot scale across multiple horizontal container instances without risk of lost tasks and split queue states.
* **No Auto-Retry Loop**: Failed notifications are logged as `failed`, but the native worker does not re-add them to the queue for a retry automatically.

---

## Architecture Diagram

The system flow is visually mapped in `architecture-diagram.png` located in the root directory.

---

## Design Decisions

This solution implements a lightweight backend strictly using native Node.js patterns and local SQLite storage:
* Excludes heavy external message brokers (Redis, RabbitMQ, Kafka, BullMQ) to ensure a minimal resource footprint.
* Implements robust transactional inserts to guarantee database integrity.
* Uses native asynchronous loop scheduling to maintain non-blocking performance.

---

## Author
**Rahul**
