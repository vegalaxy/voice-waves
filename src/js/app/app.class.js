var H   = {};
H.World = {};
H.Debug = {};
H.AI = {};
H.UI = {};

H.App = B.Core.Abstract.extend(
{
    options : {},

    construct : function()
    {
        this.ticker     = new B.Tools.Ticker();
        this.registry   = new B.Tools.Registry();
        this.keyboard   = new B.Tools.Keyboard();
        this.browser    = new B.Tools.Browser();
        this.stats      = new H.Debug.Stats();
        this.tweaks     = new H.Debug.Tweaks();
        this.microphone = new H.Microphone();
        this.setConversationalAI();
        this.setConversationalAI();
        this.scene      = new H.World.Scene();

        this.ticker.run();
    },

    /**
     * SET CONVERSATIONAL AI
     */
    setConversationalAI: function()
    {
        var that = this;

        // Load ConversationalAI class
        var script = document.createElement('script');
        script.src = 'src/js/app/conversational-ai/ConversationalAI.js';
        script.onload = function() {
            // Initialize ConversationalAI
            that.conversationalAI = new ConversationalAI();
            
            // Initialize UI components
            that.initializeAIUI();
            
            // Add to ticker update loop
            that.ticker.on('tick', function() {
                if (that.conversationalAI) {
                    that.conversationalAI.update();
                }
            });
        };
        script.onerror = function() {
            console.warn('Failed to load ConversationalAI module');
        };
        document.head.appendChild(script);
    },

    /**
     * INITIALIZE AI UI COMPONENTS
     */
    initializeAIUI: function()
    {
        var that = this;

        // Load SplashScreen
        var splashScript = document.createElement('script');
        splashScript.src = 'src/js/app/ui/SplashScreen.js';
        splashScript.onload = function() {
            that.splashScreen = new SplashScreen(that.conversationalAI);
        };
        document.head.appendChild(splashScript);

        // Load ToggleButton
        var toggleScript = document.createElement('script');
        toggleScript.src = 'src/js/app/ui/ToggleButton.js';
        toggleScript.onload = function() {
            that.toggleButton = new ToggleButton(that.conversationalAI);
        };
        document.head.appendChild(toggleScript);
    },

    /**
     * SET CONVERSATIONAL AI
     */
    setConversationalAI: function()
    {
        var that = this;

        // Load ConversationalAI class
        var script = document.createElement('script');
        script.src = 'src/js/app/conversational-ai/ConversationalAI.js';
        script.onload = function() {
            // Initialize ConversationalAI (but don't auto-connect to avoid blocking)
            that.conversationalAI = new ConversationalAI();
            
            // Add to ticker update loop
            that.ticker.on('tick', function() {
                if (that.conversationalAI) {
                    that.conversationalAI.update();
                }
            });
            
            console.log('ConversationalAI loaded and ready');
        };
        script.onerror = function() {
            console.warn('Failed to load ConversationalAI module - continuing without AI');
        };
        document.head.appendChild(script);
    }
} );
