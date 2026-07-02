# Event-Driven Notification Dispatcher

An event-driven notification dispatcher API built with Express, better-sqlite3, and a native in-memory queue. It allows clients to submit events, persist them to a relational database, trigger corresponding notification tasks, and process them in the background using an asynchronous worker loop.

## Project Overview

The service processes client events by validating payloads and immediately inserting event and pending notification records into SQLite. It places tasks onto a native in-memory array queue and responds immediately to the client with an HTTP 202 status code. An asynchronous loop processes queue items in the background, simulating notification dispatch delays and network failure rates, before updating the database.

## Tech Stack

- Runtime: Node.js
- Framework: Express.js
- Database: SQLite (better-sqlite3)
- Queue: Native Javascript In-Memory Array Queue with Async Loop

## Installation

1. Install package dependencies:
   ```bash
   npm install
   ```

2. Create your environment configuration file:
   ```bash
   cp .env.example .env
   ```

## Running the Project

### Development Mode (with Nodemon)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## SQLite Setup

The project automatically initializes the SQLite database at start up. It creates the data directory (if it does not exist) and applies the database table structures defined in `src/db/schema.sql`.

### Tables Layout

#### events
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `event_type`: TEXT NOT NULL
- `payload`: TEXT NOT NULL (JSON data)
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

#### notifications
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `event_id`: INTEGER NOT NULL (References events.id)
- `recipient`: TEXT NOT NULL
- `channel`: TEXT NOT NULL
- `status`: TEXT NOT NULL ('pending', 'completed', 'failed')
- `retry_count`: INTEGER DEFAULT 0
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

---

## API Documentation

### Register Event

- **URL**: `/api/v1/events`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

#### Sample Request

```json
{
  "event_type": "order_placed",
  "recipient": "user@example.com",
  "data": {
    "order_id": 101
  }
}
```

#### Sample Response (HTTP 202 Accepted)

```json
{
  "message": "Event accepted for processing",
  "tracking_id": 1,
  "notification_id": 1,
  "status": "pending"
}
```

#### Validation Error (HTTP 400 Bad Request)

Returned if either `event_type` or `recipient` is missing:

```json
{
  "error": "event_type and recipient are required"
}
```

#### Server Error (HTTP 500 Internal Server Error)

Returned for unhandled runtime errors:

```json
{
  "error": "Internal server error"
}
```

---

## Queue Explanation

The application implements a native asynchronous queue worker model:
1. **Queue Store**: A standard JavaScript Array `this.queue = []` behaves as a First-In-First-Out (FIFO) collection.
2. **Push Mechanism**: When a valid event is stored, a notification task object is created and appended to the array.
3. **Continuous Background Worker**: When the server boots up, `queueWorker.start()` is executed. It runs a `while(true)` loop.
4. **Worker Loop**:
   - If the queue is non-empty, it shifts the first item out and starts processing.
   - It performs a promise-based delay between 500ms and 1000ms.
   - It rolls a random number. If the roll is less than 0.10 (10% chance), it throws an error and updates the status to `failed` and increments `retry_count`. Otherwise, it updates status to `completed`.
   - If the queue is empty, the loop resolves a short setTimeout (100ms) to release the event loop before checking again.

---

## Assumptions

1. The default channel for all generated notifications is `email`.
2. The payload in the `events` table stores the custom nested `data` object sent inside the API request.
3. The queue is fully in-memory, meaning tasks reside within the Node process memory footprint.

---

## Limitations

1. **Memory Volatility**: Because the queue is held in a JavaScript memory array, any server restart, crash, or deployment will cause the pending items in the queue to be lost (though their status remains stored as `pending` in the SQLite database).
2. **Single Instance Scaling**: An in-memory queue cannot be shared across multiple Node.js server instances.
3. **No Auto-Retry Loop**: When a notification fails, the status is updated to `failed`, but the native worker does not automatically reschedule or push the item back to the queue for a retry unless manually triggered.
