const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Function to analyze meeting with ChatGPT
async function analyzeMeetingWithGPT(meetingData) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: "You are a helpful assistant that analyzes meeting transcripts and extracts key points, action items, and important decisions."
                }, {
                    role: "user",
                    content: `Please analyze this meeting data and extract the key points, decisions, and action items: ${JSON.stringify(meetingData)}`
                }]
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error analyzing meeting:', error);
        throw error;
    }
}

async function sendToSlack(message) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    try {
        const response = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: message })
        });
        return response.ok;
    } catch (error) {
        console.error('Error sending to Slack:', error);
        return false;
    }
}

app.post('/webhook', async (req, res) => {
    try {
        console.log('Received meeting data:', req.body);

        // Analyze meeting data with ChatGPT
        const analysis = await analyzeMeetingWithGPT(req.body);

        // Format message for Slack
        const message = `
*Meeting Analysis*
📅 *Title:* ${req.body.meetingTitle}
📆 *Date:* ${req.body.date}
👥 *Participants:* ${req.body.participants.join(', ')}

🤖 *AI Analysis:*
${analysis}
`;
        
        const slackResult = await sendToSlack(message);
        
        if (slackResult) {
            res.json({ success: true, message: 'Analyzed and sent to Slack successfully' });
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