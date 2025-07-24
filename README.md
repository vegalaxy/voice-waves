# Voice Waves with OpenAI Realtime API

A real-time voice visualization system integrated with OpenAI's Realtime API for interactive AI conversations.

## Features

- **Real-time Voice Visualization**: 3D wave patterns that respond to audio input
- **OpenAI Realtime API Integration**: Direct WebRTC connection for low-latency AI conversations
- **Dual Audio Analysis**: Visualizes both user input and AI responses
- **Live Transcription**: Real-time speech-to-text display
- **Interactive 3D Graphics**: Powered by Three.js with custom shaders

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure OpenAI API**:
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     ```

3. **Start the Server**:
   ```bash
   npm start
   ```

4. **Open in Browser**:
   Navigate to `http://localhost:3000`

## Usage

1. **Connect to OpenAI**: Click the "Connect to OpenAI" button in the top-right corner
2. **Grant Microphone Access**: Allow microphone permissions when prompted
3. **Start Talking**: The system will automatically detect speech and respond
4. **Watch the Visualization**: See the 3D waves react to both your voice and AI responses

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with Three.js for 3D graphics
- **Backend**: Express.js server for OpenAI API token management
- **Connection**: WebRTC for real-time audio streaming with OpenAI
- **Audio Processing**: Web Audio API for frequency analysis and visualization

### Key Components
- `H.OpenAIRealtime`: Manages WebRTC connection and OpenAI API communication
- `H.Microphone`: Handles local audio capture and analysis
- `H.World.Grid`: Creates responsive 3D wave visualizations
- `H.UI`: Provides user interface controls and status display

### Security
- Uses ephemeral API keys for client-side connections
- OpenAI API keys are only used server-side
- WebRTC provides secure peer-to-peer audio streaming

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)

## Browser Compatibility

Requires a modern browser with support for:
- WebRTC
- Web Audio API
- WebGL
- ES6 modules

## Development

For development with just the visualization (without OpenAI):
```bash
npm run dev
```

This starts a simple HTTP server on port 8000 without the OpenAI integration.