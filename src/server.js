require('dotenv').config();
const app = require('./app');
const queueWorker = require('./services/queueWorker');

const PORT = process.env.PORT || 3000;

queueWorker.start();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
