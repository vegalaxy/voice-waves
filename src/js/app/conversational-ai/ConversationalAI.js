/**
 * ConversationalAI - ElevenLabs Integration
 * Handles voice conversation with AI agent
 */
class ConversationalAI {
    constructor() {
        // ElevenLabs credentials (replace with your actual values)
        this.agentId = 'VKkqHVzHTMdhYVGSj8am'
        this.apiKey = 'sk_5eb294966f9b6ff79344c6fd5addb3edc4a97e5bceb339cc'
        
        // State variables
        this.isConnected = false
        this.isSpeaking = false
        this.isInitializing = true
        this.inputLevel = 0      // For microphone visualization
        this.outputLevel = 0     // For AI speech visualization
        this.conversation = null // ElevenLabs conversation instance
        
        // Error handling
        this.lastError = null
        this.retryCount = 0
        this.maxRetries = 3
        
        // Don't auto-initialize to avoid blocking the preview
        console.log('ConversationalAI created - call initialize() when ready')
    }
    
    async initialize() {
        try {
            this.isInitializing = true
            console.log('Initializing ConversationalAI...')
            
            // Request microphone permission first
            await this.requestMicrophonePermission()
            
            // Start conversation
            await this.startConversation()
            
            this.isInitializing = false
            console.log('ConversationalAI initialized successfully')
            
        } catch (error) {
            this.isInitializing = false
            this.lastError = error
            console.error('Failed to initialize ConversationalAI:', error)
        }
    }
    
    async requestMicrophonePermission() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true })
            console.log('Microphone permission granted')
        } catch (error) {
            throw new Error('Microphone permission denied or not available')
        }
    }
    
    async startConversation() {
        return new Promise(async (resolve, reject) => {
            try {
                // Dynamic import to handle potential loading issues
                const { Conversation } = await import('@elevenlabs/client')
                
                Conversation.startSession({
                    agentId: this.agentId,
                    apiKey: this.apiKey,
                    onConnect: () => {
                        console.log('ElevenLabs conversation connected')
                        this.isConnected = true
                        this.retryCount = 0
                        resolve()
                    },
                    onDisconnect: () => {
                        console.log('ElevenLabs conversation disconnected')
                        this.isConnected = false
                        this.isSpeaking = false
                        this.inputLevel = 0
                        this.outputLevel = 0
                    },
                    onError: (error) => {
                        console.error('ElevenLabs conversation error:', error)
                        this.lastError = error
                        reject(new Error(`ElevenLabs error: ${error.message || error}`))
                    },
                    onModeChange: (mode) => {
                        if (mode && mode.mode) {
                            console.log('Mode changed to:', mode.mode)
                            this.isSpeaking = mode.mode === 'speaking'
                            
                            // Update audio levels for visualization
                            if (mode.mode === 'speaking') {
                                this.outputLevel = 0.8
                                this.inputLevel = 0
                            } else if (mode.mode === 'listening') {
                                this.outputLevel = 0
                                this.inputLevel = 0.5
                            } else {
                                this.outputLevel = 0
                                this.inputLevel = 0
                            }
                        }
                    },
                    onMessage: (message) => {
                        console.log('Message received:', message)
                    }
                }).then((conversation) => {
                    this.conversation = conversation
                }).catch((error) => {
                    console.error('Failed to start conversation:', error)
                    reject(error)
                })
                
            } catch (error) {
                console.error('Failed to start conversation:', error)
                reject(error)
            }
        })
    }
    
    async disconnect() {
        if (this.conversation) {
            try {
                await this.conversation.endSession()
                console.log('Conversation ended')
            } catch (error) {
                console.error('Error ending conversation:', error)
            }
        }
        
        this.isConnected = false
        this.isSpeaking = false
        this.conversation = null
        this.inputLevel = 0
        this.outputLevel = 0
    }
    
    async reconnect() {
        if (this.retryCount >= this.maxRetries) {
            throw new Error('Maximum retry attempts reached')
        }
        
        this.retryCount++
        console.log(`Reconnecting... (attempt ${this.retryCount}/${this.maxRetries})`)
        
        await this.disconnect()
        await this.startConversation()
    }
    
    // Audio level methods for visualization
    getCombinedLevel() {
        return Math.max(this.inputLevel, this.outputLevel)
    }
    
    getInputLevel() {
        return this.inputLevel
    }
    
    getOutputLevel() {
        return this.outputLevel
    }
    
    isAISpeaking() {
        return this.isSpeaking
    }
    
    getConnectionStatus() {
        if (this.isInitializing) return 'initializing'
        if (this.isConnected) return 'connected'
        return 'disconnected'
    }
    
    // Called in main loop - decays audio levels for smooth visualization
    update() {
        this.inputLevel *= 0.95
        this.outputLevel *= 0.95
    }
    
    // Cleanup
    destroy() {
        this.disconnect()
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationalAI
} else if (typeof window !== 'undefined') {
    window.ConversationalAI = ConversationalAI
}