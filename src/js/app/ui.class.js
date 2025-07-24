H.UI = B.Core.Event_Emitter.extend(
{
    options : {},

    construct : function( options )
    {
        this._super( options );

        // Set up
        this.ticker     = new B.Tools.Ticker();
        this.registry   = new B.Tools.Registry();
        this.microphone = this.registry.get( 'microphone' );
        this.openai     = this.registry.get( 'openai-realtime' );

        this.$.container = document.querySelector( '.ui' );

        // Init
        this.init_controls();
        this.init_openai_controls();
    },

    /**
     * INIT OPENAI CONTROLS
     */
    init_openai_controls: function() {
        var that = this;
        
        // Create OpenAI controls container
        this.openai_controls = {};
        this.openai_controls.$ = {};
        this.openai_controls.$.container = document.createElement('div');
        this.openai_controls.$.container.className = 'openai-controls';
        this.openai_controls.$.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            min-width: 200px;
        `;
        
        // Connect button
        this.openai_controls.$.connect = document.createElement('button');
        this.openai_controls.$.connect.textContent = 'Connect to OpenAI';
        this.openai_controls.$.connect.style.cssText = `
            background: #10a37f;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 10px;
            width: 100%;
        `;
        
        // Status display
        this.openai_controls.$.status = document.createElement('div');
        this.openai_controls.$.status.textContent = 'Disconnected';
        this.openai_controls.$.status.style.cssText = `
            margin-bottom: 10px;
            padding: 5px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
        `;
        
        // Transcription display
        this.openai_controls.$.transcription = document.createElement('div');
        this.openai_controls.$.transcription.style.cssText = `
            max-height: 100px;
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.4;
        `;
        this.openai_controls.$.transcription.innerHTML = '<em>Transcription will appear here...</em>';
        
        // Add elements to container
        this.openai_controls.$.container.appendChild(this.openai_controls.$.connect);
        this.openai_controls.$.container.appendChild(this.openai_controls.$.status);
        this.openai_controls.$.container.appendChild(this.openai_controls.$.transcription);
        
        // Add to page
        document.body.appendChild(this.openai_controls.$.container);
        
        // Event listeners
        this.openai_controls.$.connect.onclick = function() {
            if (that.openai && !that.openai.connected) {
                that.openai.connect();
            }
        };
        
        // OpenAI event listeners
        if (this.openai) {
            this.openai.on('connected', function() {
                that.openai_controls.$.status.textContent = 'Connected';
                that.openai_controls.$.status.style.background = 'rgba(16, 163, 127, 0.3)';
                that.openai_controls.$.connect.textContent = 'Connected';
                that.openai_controls.$.connect.disabled = true;
                that.openai.startConversation();
            });
            
            this.openai.on('connection_error', function(error) {
                that.openai_controls.$.status.textContent = 'Connection Error: ' + error.message;
                that.openai_controls.$.status.style.background = 'rgba(255, 0, 0, 0.3)';
            });
            
            this.openai.on('transcription_completed', function(event) {
                if (event.transcript) {
                    that.openai_controls.$.transcription.innerHTML = 
                        '<strong>You:</strong> ' + event.transcript + '<br>' + 
                        that.openai_controls.$.transcription.innerHTML;
                }
            });
            
            this.openai.on('text_response', function(event) {
                if (event.delta) {
                    var currentContent = that.openai_controls.$.transcription.innerHTML;
                    if (!currentContent.includes('<strong>AI:</strong>')) {
                        that.openai_controls.$.transcription.innerHTML = 
                            '<strong>AI:</strong> ' + event.delta + '<br>' + currentContent;
                    } else {
                        // Append to existing AI response
                        that.openai_controls.$.transcription.innerHTML = 
                            currentContent.replace('<strong>AI:</strong> ', '<strong>AI:</strong> ' + event.delta);
                    }
                }
            });
        }
    }
    /**
     * INIT CONTROLS
     */
    init_controls : function()
    {
        var that = this;

        // Set up
        this.controls             = {};
        this.controls.$           = {};
        this.controls.$.container = this.$.container.querySelector( '.controls' );

        this.microphone.on( 'start_recording stop_recording', function()
        {
            if( that.microphone.mode === 'recording' )
                that.controls.$.container.classList.add( 'recording' );
            else
                that.controls.$.container.classList.remove( 'recording' );
        } );

        // Hide controls by default
        this.controls.$.container.style.display = 'none';

        // Click event
        this.controls.$.container.onclick = function( e )
        {
            that.microphone.toggle_recording();

            e.preventDefault();
        };
    }
} );
