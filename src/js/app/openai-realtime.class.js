H.OpenAIRealtime = B.Core.Event_Emitter.extend({
    options: {
        model: "gpt-4o-realtime-preview-2025-06-03",
        voice: "verse",
        sessionEndpoint: "/session"
    },

    construct: function(options) {
        this._super(options);

        // Set up
        this.registry = new B.Tools.Registry();
        this.microphone = this.registry.get('microphone');
        this.stats = this.registry.get('stats');
        
        // WebRTC components
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioElement = null;
        this.localStream = null;
        
        // State
        this.connected = false;
        this.connecting = false;
        this.ephemeralKey = null;
        
        // Audio processing
        this.audioContext = null;
        this.remoteAudioAnalyser = null;
        this.remoteAudioSource = null;
        
        // Register
        this.registry.set('openai-realtime', this);
        
        // Initialize
        this.init();
    },

    init: function() {
        this.createAudioElement();
        this.setupEventListeners();
    },

    createAudioElement: function() {
        this.audioElement = document.createElement("audio");
        this.audioElement.autoplay = true;
        this.audioElement.style.display = 'none';
        document.body.appendChild(this.audioElement);
    },

    setupEventListeners: function() {
        var that = this;
        
        // Listen for microphone events
        if (this.microphone) {
            this.microphone.on('start_recording', function() {
                if (that.connected) {
                    that.sendEvent({
                        type: 'input_audio_buffer.commit'
                    });
                }
            });
        }
    },

    async connect() {
        if (this.connecting || this.connected) {
            console.log('Already connecting or connected');
            return;
        }

        this.connecting = true;
        
        try {
            // Get ephemeral token
            await this.getEphemeralToken();
            
            // Set up WebRTC
            await this.setupWebRTC();
            
            // Create offer and connect
            await this.establishConnection();
            
            this.connected = true;
            this.connecting = false;
            
            this.trigger('connected');
            console.log('Connected to OpenAI Realtime API');
            
        } catch (error) {
            this.connecting = false;
            this.connected = false;
            console.error('Failed to connect to OpenAI Realtime API:', error);
            this.trigger('connection_error', [error]);
        }
    },

    async getEphemeralToken() {
        // Try relative path first (when served from Express server)
        let response;
        try {
            response = await fetch(this.options.sessionEndpoint, {
                method: 'POST'
            });
        } catch (error) {
            // If relative path fails, try the Express server on port 3000
            try {
                response = await fetch(`http://localhost:3000${this.options.sessionEndpoint}`, {
                    method: 'POST'
                });
            } catch (fallbackError) {
                throw new Error('Cannot connect to OpenAI session endpoint. Make sure to run "npm start" to enable OpenAI integration.');
            }
        }
        
        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (jsonError) {
                // Response is not JSON, likely HTML error page
                errorMessage = `Server error (${response.status}). Make sure to run 'npm start' instead of 'npm run dev' to enable OpenAI integration.`;
            }
            throw new Error(`Failed to get ephemeral token: ${errorMessage}`);
        }
        
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error('Invalid response from session endpoint. Make sure to run "npm start" instead of "npm run dev" to enable OpenAI integration.');
        }
        
        this.ephemeralKey = data.client_secret.value;
        
        if (!this.ephemeralKey) {
            throw new Error('No ephemeral key received from server');
        }
    },

    async setupWebRTC() {
        // Create peer connection
        this.peerConnection = new RTCPeerConnection();

        var that = this;

        // Handle remote audio stream - following official docs
        this.peerConnection.ontrack = function(event) {
            console.log('Received remote audio track');
            that.audioElement.srcObject = event.streams[0];
            that.setupRemoteAudioAnalysis(event.streams[0]);
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = function() {
            console.log('Connection state:', that.peerConnection.connectionState);
            if (that.peerConnection.connectionState === 'failed') {
                that.trigger('connection_error', [new Error('WebRTC connection failed')]);
            }
        };

        // Get user media and add track - following official docs
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true
            });
            
            // Add the first audio track as per documentation
            this.peerConnection.addTrack(this.localStream.getTracks()[0]);
        } catch (error) {
            throw new Error(`Failed to get user media: ${error.message}`);
        }

        // Set up data channel for events - following official docs
        this.dataChannel = this.peerConnection.createDataChannel("oai-events");
        
        this.dataChannel.addEventListener("open", function() {
            console.log('Data channel opened');
            that.trigger('data_channel_open');
        });
        
        this.dataChannel.addEventListener("message", function(event) {
            // Realtime server events appear here as per docs
            console.log('Received event:', event);
            that.handleRealtimeEvent(JSON.parse(event.data));
        });
        
        this.dataChannel.addEventListener("error", function(error) {
            console.error('Data channel error:', error);
            that.trigger('data_channel_error', [error]);
        });
    },

    async establishConnection() {
        // Create offer - following official docs
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Send offer to OpenAI - following official docs exactly
        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = this.options.model;
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${this.ephemeralKey}`,
                "Content-Type": "application/sdp"
            },
        });

        if (!sdpResponse.ok) {
            throw new Error(`SDP exchange failed: ${sdpResponse.statusText}`);
        }

        // Set remote description - following official docs
        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };
        
        await this.peerConnection.setRemoteDescription(answer);
    },

    setupRemoteAudioAnalysis: function(stream) {
        var that = this;
        
        // Create audio context for analyzing AI responses
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.remoteAudioSource = this.audioContext.createMediaStreamSource(stream);
        this.remoteAudioAnalyser = this.audioContext.createAnalyser();
        
        this.remoteAudioAnalyser.fftSize = 512;
        this.remoteAudioSource.connect(this.remoteAudioAnalyser);
        
        // Start analyzing remote audio for visualization
        this.analyzeRemoteAudio();
    },

    analyzeRemoteAudio: function() {
        var that = this;
        
        if (!this.remoteAudioAnalyser || !this.connected) {
            return;
        }
        
        var bufferLength = this.remoteAudioAnalyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        
        function analyze() {
            if (!that.connected) return;
            
            that.remoteAudioAnalyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume from AI response
            var sum = 0;
            for (var i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            var averageVolume = sum / bufferLength;
            
            // Trigger event with AI audio data for visualization
            that.trigger('ai_audio_data', [{
                volume: averageVolume,
                frequencyData: dataArray,
                timestamp: Date.now()
            }]);
            
            requestAnimationFrame(analyze);
        }
        
        analyze();
    },

    sendEvent: function(event) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.warn('Data channel not ready, cannot send event:', event);
            return;
        }
        
        try {
            this.dataChannel.send(JSON.stringify(event));
        } catch (error) {
            console.error('Failed to send event:', error);
        }
    },

    handleRealtimeEvent: function(event) {
        console.log('Received OpenAI event:', event);
        
        // Update stats if available
        if (this.stats) {
            this.stats.update_info('openai_event_type', event.type);
        }
        
        // Handle different event types
        switch (event.type) {
            case 'session.created':
                this.trigger('session_created', [event]);
                break;
                
            case 'response.audio.delta':
                // AI is speaking - this will be handled by the audio element
                this.trigger('ai_speaking', [event]);
                break;
                
            case 'response.audio.done':
                this.trigger('ai_finished_speaking', [event]);
                break;
                
            case 'input_audio_buffer.speech_started':
                this.trigger('user_speech_started', [event]);
                break;
                
            case 'input_audio_buffer.speech_stopped':
                this.trigger('user_speech_stopped', [event]);
                break;
                
            case 'conversation.item.input_audio_transcription.completed':
                this.trigger('transcription_completed', [event]);
                break;
                
            case 'response.text.delta':
                this.trigger('text_response', [event]);
                break;
                
            case 'error':
                console.error('OpenAI Realtime API error:', event);
                this.trigger('api_error', [event]);
                break;
                
            default:
                this.trigger('realtime_event', [event]);
        }
    },

    startConversation: function() {
        if (!this.connected) {
            console.warn('Not connected to OpenAI Realtime API');
            return;
        }
        
        // Send session update to start the conversation
        this.sendEvent({
            type: 'session.update',
            session: {
                instructions: "You are a helpful AI assistant integrated with a voice visualization system. Keep responses engaging and concise.",
                voice: this.options.voice,
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200
                }
            }
        });
    },

    disconnect: function() {
        this.connected = false;
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.trigger('disconnected');
        console.log('Disconnected from OpenAI Realtime API');
    }
});