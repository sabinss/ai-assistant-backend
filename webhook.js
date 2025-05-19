// webhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
// Verify token endpoint
router.get('/', (req, res) => {
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

// Receive messages
router.post('/', (req, res) => {
    console.log('📩 Webhook triggered');
    console.dir(req.body, { depth: null });
    res.sendStatus(200);
});

router.get('/send-message', async (req, res) => {
    const token = process.env.WHATS_APP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATS_APP_PHONE_NUMBER_ID;
    const to = '+977 984-3063571'; // e.g., +1415xxxxxxx
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: {
                    body: 'Hello from Node.js via WhatsApp Cloud API!'
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            }
        );

        console.log('Message sent:', response.data);
        res.status(200).json({
            success: true,
            data: response.data
        });
    } catch (err) {
        console.error('Error sending message:', err.response?.data || err.message);
    }
});

module.exports = router;

// curl -i -X POST \
//   https://graph.facebook.com/v22.0/663591333502681/messages \
//   -H 'Authorization: Bearer EABGA7OOo0BwBOZBth8cKrSS7v70i0fKEegozAibKInicOb5RLawKid8TyYc0D9kCwngCieFD5c4wQa7wgXydV8Fc5Q85pAk2wzsiOh6gAWph7WQY5JRZC1KkDOA7QOFf4jgZA6L7MEcovA5TIgXkdF6p3rXXoufXG9XA7zjZBIKZCTcMlLZCYatsDwPNRuzzTg8GMRHZAjXgf88PHY0yn7Ti2DmIeEZD' \
//   -H 'Content-Type: application/json' \
//   -d '{ "messaging_product": "whatsapp", "to": "9779843063571", "type": "template", "template": { "name": "hello_world", "language": { "code": "en_US" } } }'
