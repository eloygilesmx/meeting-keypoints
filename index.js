const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

async function sendToSlack(message) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    try {
        console.log('Attempting to send to Slack...', { message, webhookUrl: slackWebhookUrl });
        
        const response = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: typeof message === 'string' ? message : JSON.stringify(message, null, 2)
            })
        });
        
        const responseText = await response.text();
        console.log('Slack response:', responseText);
        
        return response.ok;
    } catch (error) {
        console.error('Error sending to Slack:', error.message);
        return false;
    }
}

app.post('/webhook', async (req, res) => {
    try {
        console.log('Received webhook data:', req.body);
        
        // Format the message nicely
        const message = `
*New Meeting Summary*
📅 *Title:* ${req.body.meetingTitle}
📆 *Date:* ${req.body.date}
👥 *Participants:* ${req.body.participants.join(', ')}

📝 *Summary:*
${req.body.summary}

✅ *Action Items:*
${req.body.actionItems.map(item => `• ${item}`).join('\n')}
`;
        
        const slackResult = await sendToSlack(message);
        console.log('Slack send result:', slackResult);
        
        if (slackResult) {
            res.json({ success: true, message: 'Sent to Slack successfully' });
        } else {
            res.json({ success: false, message: 'Failed to send to Slack' });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});