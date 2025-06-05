const axios = require('axios');
async function regenerateToken() {
    const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.FB_APP_ID,
            client_secret: process.env.FB_APP_SECRET,
            fb_exchange_token: process.env.FB_EXPIRED_TOKEN
        }
    });

    return res.data.access_token;
}

async function refreshAccessTokenAndUpdateOrg(orgId) {
    try {
        const org = await Organization.findById(orgId).select('whatsappConfig');
        if (!org || !org.whatsappConfig || !org.whatsappConfig.whatsappToken) {
            throw new Error('Organization or WhatsApp config not found');
        }
        const oldToken = org.whatsappConfig.whatsappToken;

        const response = await axios.get(`https://graph.facebook.com/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.WHATSAPP_APP_ID,
                client_secret: process.env.WHATSAPP_SECRET_KEY,
                fb_exchange_token: oldToken
            }
        });
        const newToken = response.data.access_token;

        console.log('🔄 Token refreshed:', newToken);
        // 3. Update the organization's WhatsApp config
        org.whatsappConfig.whatsappToken = newToken;
        await org.save();

        console.log('✅ Token refreshed and organization updated');
        return newToken;

        // You can optionally save this token in DB or file for future use
    } catch (error) {
        console.error('❌ Failed to refresh token:', error.response?.data || error.message);
    }
}
