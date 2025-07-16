H.World.Atmosphere = B.Core.Abstract.extend(
{
    options: {
        fog: {
            active: true,
            color: 0x1a1a2e,
            near: 50,
            far: 800,
            density: 0.002
        },
        volumetric: {
            active: true,
            intensity: 1.0,
            color: 0x4a6fa5,
            opacity: 0.4,
            animation_speed: 0.0005
        }
    },

    construct: function(options) {
        this._super(options);

        // Set up
        this.registry = new B.Tools.Registry();
        this.ticker = new B.Tools.Ticker();
        this.scene = this.registry.get('scene');
        this.camera = this.registry.get('camera');
        this.microphone = this.registry.get('microphone');

        // Initialize components
        this.init_fog();
        this.init_volumetric_lighting();
        this.init_events();
        this.init_debug();
    },

    /**
     * INIT FOG
     */
    init_fog: function() {
        if (!this.options.fog.active) return;

        console.log('Initializing fog...');
        
        // Create exponential fog for more atmospheric effect
        this.fog = new THREE.FogExp2(
            this.options.fog.color,
            this.options.fog.density
        );

        // Apply to scene
        this.scene.object.fog = this.fog;
        console.log('Fog applied to scene:', this.fog);
    },

    /**
     * INIT VOLUMETRIC LIGHTING
     */
    init_volumetric_lighting: function() {
        if (!this.options.volumetric.active) return;

        console.log('Initializing volumetric lighting...');
        
        // Create simple volumetric background planes
        this.volumetric = {};
        this.volumetric.geometry = new THREE.PlaneGeometry(1000, 600, 1, 1);
        
        // Simple material to avoid shader conflicts
        this.volumetric.material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.NormalBlending,
            uniforms: {
                uTime: { type: 'f', value: 0 },
                uOpacity: { type: 'f', value: this.options.volumetric.opacity }
            },
            vertexShader: [
                'varying vec2 vUv;',
                '',
                'void main() {',
                '    vUv = uv;',
                '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform float uTime;',
                'uniform float uOpacity;',
                'varying vec2 vUv;',
                '',
                'void main() {',
                '    // Simple gradient from center',
                '    vec2 center = vec2(0.5, 0.5);',
                '    float dist = distance(vUv, center);',
                '    ',
                '    // Animated subtle effect',
                '    float wave = sin(uTime * 0.5 + dist * 10.0) * 0.1 + 0.9;',
                '    ',
                '    // Blue atmospheric color',
                '    vec3 color = vec3(0.2, 0.4, 0.8);',
                '    ',
                '    float alpha = (1.0 - dist) * uOpacity * wave;',
                '    gl_FragColor = vec4(color, alpha);',
                '}'
            ].join('\n')
        });

        // Create multiple background planes for depth
        this.volumetric.meshes = [];
        
        for (var i = 0; i < 3; i++) {
            var mesh = new THREE.Mesh(this.volumetric.geometry, this.volumetric.material.clone());
            mesh.position.set(0, 100, -200 - (i * 100));
            mesh.rotation.x = -Math.PI * 0.1;
            mesh.material.uniforms.uOpacity.value = this.options.volumetric.opacity * (1 - i * 0.3);
            this.volumetric.meshes.push(mesh);
            this.scene.object.add(mesh);
        }
        
        console.log('Simplified volumetric lighting added');
    },

    /**
     * INIT EVENTS
     */
    init_events: function() {
        var that = this;

        this.ticker.on('tick', function(infos) {
            that.frame(infos);
        });
    },

    /**
     * INIT DEBUG
     */
    init_debug: function() {
        var that = this,
            ui = this.registry.get('dat-gui');

        // Folder
        var folder = ui.addFolder('Atmosphere');
        // folder.open();

        // Fog controls
        var fogFolder = folder.addFolder('Fog');
        
        var fogActive = fogFolder.add(this.options.fog, 'active');
        fogActive.name('active');
        fogActive.onChange(function(value) {
            if (value) {
                that.init_fog();
            } else {
                that.scene.object.fog = null;
            }
        });

        var fogDensity = fogFolder.add(this.options.fog, 'density', 0, 0.005).step(0.0001);
        fogDensity.name('density');
        fogDensity.onChange(function(value) {
            if (that.fog) {
                that.fog.density = value;
            }
        });

        // Volumetric controls
        if (this.volumetric) {
            var volumetricFolder = folder.addFolder('Volumetric');
            
            var volumetricActive = volumetricFolder.add(this.options.volumetric, 'active');
            volumetricActive.name('active');
            volumetricActive.onChange(function(value) {
                that.volumetric.mesh.visible = value;
            });

            var volumetricIntensity = volumetricFolder.add(this.options.volumetric, 'intensity', 0, 1).step(0.01);
            volumetricIntensity.name('intensity');
            volumetricIntensity.onChange(function(value) {
                that.volumetric.material.uniforms.uIntensity.value = value;
            });

            var volumetricOpacity = volumetricFolder.add(this.options.volumetric, 'opacity', 0, 0.5).step(0.01);
            volumetricOpacity.name('opacity');
            volumetricOpacity.onChange(function(value) {
                that.volumetric.material.uniforms.uOpacity.value = value;
            });
        }
    },

    /**
     * FRAME
     */
    frame: function(infos) {
        if (this.volumetric && this.volumetric.material) {
            // Update time for animation
            this.volumetric.material.uniforms.uTime.value = infos.elapsed * 0.001;
            
            // Update camera position for distance calculations
            if (this.camera && this.camera.object) {
                this.volumetric.material.uniforms.uCameraPosition.value.copy(this.camera.object.position);
            }
            
            // Audio reactivity - very subtle
            var audioLevel = 0;
            if (this.microphone && this.microphone.values) {
                audioLevel = this.microphone.values.volume.smoothed * 0.02; // Slightly more visible
            }
            this.volumetric.material.uniforms.uAudioLevel.value = audioLevel;
        }
    }
});