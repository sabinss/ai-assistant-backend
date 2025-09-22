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
const helmet = require('helmet');

//todo chat message sort by created date aila sorting milara ako chainclear
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
const db = require('./helper/db');
const { googleOauthHandler } = require('./controllers/session.controller');
const { handleTaskAgentCronJob } = require('./cronJob/taskAgentJob');
const webhookRoute = require('./webhook');
const Organization = require('./models/Organization');
const User = require('./models/User');
app.use(express.json());
const { v4: uuidv4 } = require('uuid');
const AgentCronLogSchema = require('./models/AgentCronLogSchema');

const corsOptions = {
  origin: '*',
  credentials: true,
};
// Remove 'X-Powered-By' header (leaks Express info)
app.disable('x-powered-by');
app.use(helmet());

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '40mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '40mb' }));

// app.options('*', cors(corsOptions)); // Preflight request support
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 5MB.' });
  }
  next(err);
});
db.connect();
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none';");
  next();
});

app.get('/health-check', async (req, res) => {
  const check = await db.connect();
  if (!check) {
    res.status(500).send('Not OK');
  }
  res.status(200).send('CoWrkr API running..');
});

app.get('/api/sessions/oauth/google', googleOauthHandler);
// app.use('/webhook', webhookRoute);
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'my_verify_token'; // same as what you'll enter on Meta

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
const processedMessages = new Set(); // Use Redis or DB for production
const sessions = new Map(); // In-memory map: { senderNumber => sessionId }

const SESSION_TIMEOUT_MINUTES = 10;
function createOrUpdateSession(senderNumber) {
  const existing = sessions.get(senderNumber);
  if (existing) {
    clearTimeout(existing.timeoutId);
  }

  const sessionId = existing?.sessionId || uuidv4(); // use old or new session
  const timeoutId = setTimeout(() => {
    console.log(`🕒 Session expired for ${senderNumber}`);
    sessions.delete(senderNumber);
  }, SESSION_TIMEOUT_MINUTES * 60 * 1000); // 10 minutes

  sessions.set(senderNumber, { sessionId, timeoutId });
  return sessionId;
}

// Receive messages
app.post('/webhook', async (req, res) => {
  console.log('webhook triggered', req.body.entry);
  const entry = req.body.entry;

  if (
    entry &&
    entry.length > 0 &&
    entry[0].changes &&
    entry[0].changes.length > 0
  ) {
    const change = entry[0].changes[0];
    const phoneNumberId = change?.value?.metadata?.phone_number_id;

    if (
      change.value &&
      change.value.messages &&
      change.value.messages.length > 0
    ) {
      const message = change.value.messages[0];
      const senderNumber = message.from; // e.g. '9779843063571'
      const whatsAppMessage = message.text?.body || ''; // message content
      const messageId = message.id;
      // 🧠 Deduplication check
      if (processedMessages.has(messageId)) {
        console.log('Duplicate message. Skipping:', messageId);
        return;
      }
      processedMessages.add(messageId);
      setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000); // 5 min
      console.log('Sender:', senderNumber);
      console.log('Message:', whatsAppMessage);
      // 🔍 Find organization with matching WhatsApp Phone Number ID
      const organization = await Organization.findOne({
        'whatsappConfig.whatsAppPhoneNumberId': phoneNumberId,
      });
      console.log('organization', organization);

      if (!organization) {
        console.log('No organization found for this WhatsApp number.');
        return;
      }
      let user_email = null;

      const user = await User.findOne({
        organization: organization._id,
      });
      if (user) {
        user_email = user.email;
      }
      console.log('user', user);

      let url = `${
        process.env.AI_AGENT_SERVER_URI
      }/ask/public?query=${encodeURIComponent(
        whatsAppMessage
      )}&user_email=${user_email}&org_id=${organization._id}&customer_id=null`;
      console.log('url', url);

      // Generate or retrieve session ID
      let sessionId = createOrUpdateSession(senderNumber);
      if (sessionId) {
        url += `&session_id=${encodeURIComponent(sessionId)}`;
      }

      const response = await axios.get(url);
      const answer = response.data.message;
      console.log('answer', answer);
      if (answer) {
        const { whatsAppPhoneNumberId, whatsappToken } =
          organization.whatsappConfig;

        const url = `https://graph.facebook.com/v22.0/${whatsAppPhoneNumberId}/messages`;
        // Payload for WhatsApp message
        // +18137863140
        const payload = {
          messaging_product: 'whatsapp',
          // to: '9779843063571',
          to: senderNumber ? senderNumber : '18137863140',
          type: 'text',
          text: {
            body: answer,
          },
        };
        try {
          const response = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (err) {
          console.log('Whatspp message send failed', err);
        }
      }
    } else {
      console.log('No message content received.');
    }
  } else {
    console.log('No entry/changes in webhook payload.');
  }
  return res.status(200).end(); // ✅ always respond once and only once
});

app.post('/api/send-whatsapp', async (req, res) => {
  console.log('Message received from python server', req.body);
  const { organization_id: orgId, message, to } = req.body;

  try {
    if (!orgId) {
      console.log('orgId  is missing, cannot fetch whatsapp config');
    }
    const organization = await Organization.findById(orgId).select(
      'whatsappConfig'
    );
    const { whatsappPhoneNumber, whatsAppPhoneNumberId, whatsappToken } =
      organization.whatsappConfig;
    console.log(
      'whatsapp config',
      whatsappPhoneNumber,
      whatsAppPhoneNumberId,
      whatsappToken
    );
    if (!whatsappToken || !whatsAppPhoneNumberId || !whatsappPhoneNumber) {
      console.log('Whatsapp config is missing');
    }
    // Clean and format the recipient phone number to E.164 format (basic example)
    const formattedToNumber = whatsappPhoneNumber.replace(/\D/g, ''); // remove non-digits
    const e164Number = `+${formattedToNumber}`;

    // WhatsApp API endpoint
    const url = `https://graph.facebook.com/v22.0/${whatsAppPhoneNumberId}/messages`;
    console.log('uri', url, e164Number);
    // Payload for WhatsApp message
    const payload = {
      messaging_product: 'whatsapp',
      to: to ? to : '18137863140',
      type: 'text',
      text: {
        body: message,
      },
    };
    console.log('whatsapp payload', payload);
    // Send the message via HTTP POST using axios
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
    });
    res
      .status(200)
      .json({ success: true, message: 'Whatsapp message send successfully' });

    console.log('WhatsApp message sent:', response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
});
require('./service/userAuth');
require('./models');
require('./routes')(app);
// Run every day at 6 AM UTC (1 AM EST)
let cronTrigger = '0 6 * * *';
// let cronTrigger = '*/1 * * * *';
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
