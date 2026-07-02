const express = require('express');
const eventRoutes = require('./routes/eventRoutes');

const app = express();

app.use(express.json());
app.use('/api/v1', eventRoutes);

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "Invalid JSON payload" });
    }
    return res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
