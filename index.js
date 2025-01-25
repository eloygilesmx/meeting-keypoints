const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const app = express();

app.use(express.json({
   verify: (req, res, buf) => {
       req.rawBody = buf;
   }
}));

function verifyCirclebackSignature(req, res, next) {
   console.log('Verifying signature...');
   const signature = req.headers['x-signature'] || req.headers['x-circleback-signature'];
   console.log('Headers received:', req.headers);
   console.log('Signature:', signature);

   if (!signature) {
       console.log('Proceeding without signature verification');
       return next();
   }

   try {
       const secret = process.env.CIRCLEBACK_SECRET;
       const hmac = crypto.createHmac('sha256', secret)
           .update(req.rawBody)
           .digest('hex');

       if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) {
           console.log('Invalid signature');
           return res.status(401).json({ error: 'Invalid signature' });
       }
   } catch (error) {
       console.error('Signature verification error:', error);
       return res.status(401).json({ error: 'Signature verification failed' });
   }

   next();
}

app.use((req, res, next) => {
   res.header('Access-Control-Allow-Origin', '*');
   res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
   res.header('Access-Control-Allow-Headers', 'Content-Type, x-circleback-signature, x-signature');
   next();
});

async function analyzeMeetingWithGPT(meetingData) {
   try {
       if (!meetingData) {
           throw new Error('No meeting data provided');
       }

       const systemPrompt = `You are a growth & SEO agency's meeting analyst. This is a client meeting summary tool. Meetings typically involve client feedback on website redesigns, content strategy, and SEO performance. When analyzing meetings, structure the output as follows:

1. Meeting Context:
📊 CLIENT FEEDBACK:
- Capture specific client comments and reactions
- Note any concerns or praise
- Flag any misaligned expectations

🎯 PROJECT STATUS:
- Current phase of work
- What was presented/reviewed
- Areas needing client input/approval
- Changes in project scope [if any]

💡 STRATEGIC INSIGHTS:
- Key opportunities identified
- Competitive insights discussed
- Performance metrics highlights
- Areas for optimization

⚠️ RISKS & BLOCKERS:
- Client concerns or hesitations
- Technical limitations discovered
- Resource constraints
- Timeline challenges
- Dependencies on client input/actions

✅ ACTION ITEMS:
Format each as: "[Priority] What - Owner (Deadline) {Client/Agency} [Status]"
For each item specify:
- What: Clear task description
- Owner: Team member responsible (Designer/Developer/SEO/Manager)
- Deadline: Date needed
- Priority: HIGH/MEDIUM/LOW
- Type: Client deliverable or Agency task
- Dependencies: Required input or approvals
- Status: PENDING/IN PROGRESS/BLOCKED/NEEDS CLIENT INPUT

2. Error Handling:
- Mark unclear client requirements as "[NEEDS CLARIFICATION]"
- Flag scope changes as "[SCOPE CHANGE]"
- Mark items needing client approval as "[AWAITING CLIENT APPROVAL]"
- Note missing deadlines as "[DEADLINE NEEDED]"
- Flag resource conflicts as "[RESOURCE CONFLICT]"

3. Next Steps:
- List needed follow-up meetings
- Note required client decisions
- Highlight upcoming milestones`;

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
                   content: systemPrompt
               }, {
                   role: "user",
                   content: `Analyze this client meeting data, focusing on client feedback, project status, and clear next steps for both agency team and client. Meeting Data:\n${JSON.stringify(meetingData, null, 2)}`
               }]
           })
       });

       if (!response.ok) {
           throw new Error(`OpenAI API error: ${response.status}`);
       }

       const data = await response.json();
       
       if (!data.choices || !data.choices[0] || !data.choices[0].message) {
           throw new Error('Invalid response from OpenAI API');
       }

       return data.choices[0].message.content;

   } catch (error) {
       console.error('Error in meeting analysis:', error);
       return `Error analyzing meeting: ${error.message}\n\nRaw meeting data received:\n${JSON.stringify(meetingData, null, 2)}`;
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

app.post('/webhook', (req, res, next) => {
   console.log('Received POST request to /webhook');
   console.log('Request headers:', req.headers);
   console.log('Request body:', req.body);
   next();
}, verifyCirclebackSignature, async (req, res) => {
   try {
       console.log('Request body type:', typeof req.body);
       console.log('Request body keys:', Object.keys(req.body));
       console.log('Full request body:', JSON.stringify(req.body, null, 2));
       
       if (!req.body || !req.body.meetingTitle) {
           console.error('Invalid meeting data format');
           return res.status(400).json({ error: 'Invalid meeting data format' });
       }

       const analysis = await analyzeMeetingWithGPT(req.body);
       const message = `
*Meeting Analysis*
📅 *Title:* ${req.body.meetingTitle || 'N/A'}
📆 *Date:* ${req.body.date || 'N/A'}
👥 *Participants:* ${Array.isArray(req.body.participants) ? req.body.participants.join(', ') : 'N/A'}

${analysis}`;
       
       const slackResult = await sendToSlack(message);
       return res.json({ success: slackResult });
   } catch (error) {
       console.error('Full error:', error);
       return res.status(500).json({ error: error.message });
   }
});

app.get('/', (req, res) => {
   res.send('Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
});