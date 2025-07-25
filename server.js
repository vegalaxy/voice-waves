import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use(express.static('.'));

// Session endpoint for OpenAI Realtime API
app.post('/session', async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ 
                error: 'OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.' 
            });
        }

        // Create ephemeral token for OpenAI Realtime API
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-10-01',
                voice: 'alloy'
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', errorText);
            return res.status(response.status).json({ 
                error: `OpenAI API error: ${response.statusText}` 
            });
        }

        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Session endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to create OpenAI session' 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Make sure to set OPENAI_API_KEY in your .env file');
});