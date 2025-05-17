require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./routes/swagger');
const port = process.env.PORT || 8000;
const cors = require('cors');
const app = express();
const cron = require('node-cron');
const axios = require('axios');
//todo chat message sort by created date aila sorting milara ako chainclear
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
const db = require('./helper/db');
const { googleOauthHandler } = require('./controllers/session.controller');
const { handleTaskAgentCronJob } = require('./cronJob/taskAgentJob');

app.use(express.json());

const corsOptions = {
    origin: '*',
    credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
// app.options('*', cors(corsOptions)); // Preflight request support
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size is 5MB.' });
    }
    next(err);
});
db.connect();
app.get('/health-check', async (req, res) => {
    const check = await db.connect();
    if (!check) {
        res.status(500).send('Not OK');
    }
    res.status(200).send('CoWrkr API running..');
});

app.get('/api/sessions/oauth/google', googleOauthHandler);

require('./service/userAuth');
require('./models');
require('./routes')(app);
// Run every day at 6 AM UTC (1 AM EST)
let cronTrigger = '* 6 * * *';
cron.schedule(cronTrigger, async () => {
    console.log('Running job at 6:00 AM GMT / 1:00 AM EST');
    try {
        await handleTaskAgentCronJob();
        console.log('task agent cron job completed');
    } catch (err) {
        console.log('Cron job error', err);
    }
});

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});
