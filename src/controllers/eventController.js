const eventService = require('../services/eventService');

class EventController {
    createEvent(req, res) {
        try {
            const { event_type, recipient, data } = req.body;

            if (!event_type || !recipient) {
                return res.status(400).json({
                    error: "event_type and recipient are required"
                });
            }

            const result = eventService.createEvent(event_type, recipient, data);
            return res.status(202).json({
                message: "Event accepted for processing",
                tracking_id: result.tracking_id,
                notification_id: result.notification_id,
                status: result.status
            });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error"
            });
        }
    }
}

module.exports = new EventController();
