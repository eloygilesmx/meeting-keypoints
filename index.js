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
   const signature = req.headers['x-circleback-signature'];
   const secret = process.env.CIRCLEBACK_SECRET;

   if (!signature) {
       console.log('No signature header found');
       return res.status(401).json({ error: 'No signature header' });
   }

   try {
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
   res.header('Access-Control-Allow-Headers', 'Content-Type, x-circleback-signature');
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

app.post('/webhook', verifyCirclebackSignature, async (req, res) => {
   console.log('Headers:', JSON.stringify(req.headers, null, 2));
   console.log('Raw Body:', req.rawBody?.toString());
   console.log('Parsed Body:', req.body);
   
   try {
       const analysis = await analyzeMeetingWithGPT(req.body);

       const message = `
*Meeting Analysis*
📅 *Title:* ${req.body.meetingTitle}
📆 *Date:* ${req.body.date}
👥 *Participants:* ${req.body.participants.join(', ')}

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