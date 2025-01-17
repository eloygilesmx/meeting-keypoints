const express = require('express');
const app = express();

// Allow JSON parsing
app.use(express.json());

// Basic endpoint that receives POST requests
app.post('/webhook', (req, res) => {
    console.log('Received webhook:', req.body);
    res.send('Received!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});