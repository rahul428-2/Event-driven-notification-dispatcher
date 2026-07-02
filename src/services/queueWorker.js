const db = require('../db/database');
const notificationService = require('./notificationService');

class QueueWorker {
    constructor() {
        this.queue = [];
    }

    push(item) {
        this.queue.push(item);
    }

    async start() {
        while (true) {
            if (this.queue.length > 0) {
                const notif = this.queue.shift();
                try {
                    await notificationService.send(notif.recipient, notif.data);
                    db.prepare("UPDATE notifications SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(notif.id);
                } catch (error) {
                    try {
                        db.prepare("UPDATE notifications SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(notif.id);
                    } catch (dbErr) {
                        console.error(dbErr);
                    }
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
}

module.exports = new QueueWorker();
