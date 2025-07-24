H.OpenAIRealtime = B.Core.Event_Emitter.extend({
    options: {
        model: "gpt-4o-realtime-preview-2024-10-01",
        voice: "alloy",
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
        const response = await fetch(this.options.sessionEndpoint);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to get ephemeral token: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        this.ephemeralKey = data.client_secret.value;
        
        if (!this.ephemeralKey) {
            throw new Error('No ephemeral key received from server');
        }
    },

    async setupWebRTC() {
        // Create peer connection
        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        var that = this;

        // Handle remote audio stream
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

        // Get user media and add track
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 24000
                } 
            });
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        } catch (error) {
            throw new Error(`Failed to get user media: ${error.message}`);
        }

        // Set up data channel for events
        this.dataChannel = this.peerConnection.createDataChannel("oai-events");
        
        this.dataChannel.addEventListener("open", function() {
            console.log('Data channel opened');
            that.trigger('data_channel_open');
        });
        
        this.dataChannel.addEventListener("message", function(event) {
            that.handleRealtimeEvent(JSON.parse(event.data));
        });
        
        this.dataChannel.addEventListener("error", function(error) {
            console.error('Data channel error:', error);
            that.trigger('data_channel_error', [error]);
        });
    },

    async establishConnection() {
        // Create offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Send offer to OpenAI
        const baseUrl = "https://api.openai.com/v1/realtime";
        const sdpResponse = await fetch(`${baseUrl}?model=${this.options.model}`, {
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

        const answerSdp = await sdpResponse.text();
        const answer = {
            type: "answer",
            sdp: answerSdp,
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