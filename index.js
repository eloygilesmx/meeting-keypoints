const express = require('express');
const app = express();

// Allow JSON parsing and CORS
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Function to send message to Slack
async function sendToSlack(message) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    try {
        const response = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: message }),
        });
        return response.ok;
    } catch (error) {
        console.error('Error sending to Slack:', error);
        return false;
    }
}

app.get('/webhook', (req, res) => {
    res.send('Webhook endpoint is ready to receive POST requests. If you see this message, the endpoint is working!');
});

app.post('/webhook', async (req, res) => {
    console.log('Received webhook:', req.body);
    
    // Here we'll process the meeting data and send it to Slack
    const message = `New meeting summary received:\n${JSON.stringify(req.body, null, 2)}`;
    
    const slackResult = await sendToSlack(message);
    
    res.send(slackResult ? 'Processed and sent to Slack!' : 'Received but failed to send to Slack');
});

app.get('/', (req, res) => {
    res.send('Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});