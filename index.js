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

// Basic endpoint that receives POST requests
app.post('/webhook', (req, res) => {
    console.log('Received webhook:', req.body);
    res.send('Received!');
});

// Add a basic GET endpoint for testing
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});