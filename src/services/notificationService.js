class NotificationService {
    send(recipient, data) {
        return new Promise((resolve, reject) => {
            const delay = Math.floor(Math.random() * 501) + 500;
            setTimeout(() => {
                if (Math.random() < 0.1) {
                    reject(new Error("Failed to send notification"));
                } else {
                    resolve({ success: true });
                }
            }, delay);
        });
    }
}

module.exports = new NotificationService();
