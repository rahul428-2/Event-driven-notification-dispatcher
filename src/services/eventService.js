const db = require('../db/database');
const queueWorker = require('./queueWorker');

class EventService {
    createEvent(eventType, recipient, data) {
        const payloadStr = JSON.stringify(data || {});
        let eventId;
        let notificationId;

        const transaction = db.transaction(() => {
            const eventStmt = db.prepare("INSERT INTO events (event_type, payload) VALUES (?, ?)");
            const eventRes = eventStmt.run(eventType, payloadStr);
            eventId = eventRes.lastInsertRowid;

            const notifStmt = db.prepare("INSERT INTO notifications (event_id, recipient, channel, status) VALUES (?, ?, 'email', 'pending')");
            const notifRes = notifStmt.run(eventId, recipient);
            notificationId = notifRes.lastInsertRowid;
        });

        transaction();

        queueWorker.push({
            id: notificationId,
            recipient: recipient,
            data: data
        });

        return {
            tracking_id: eventId,
            notification_id: notificationId,
            status: "pending"
        };
    }
}

module.exports = new EventService();
