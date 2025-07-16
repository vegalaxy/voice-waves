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
        
        // Create volumetric light geometry - large sphere around the scene
        this.volumetric = {};
        this.volumetric.geometry = new THREE.SphereGeometry(800, 32, 16);
        
        // Custom shader material for volumetric effect
        this.volumetric.material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide, // Render from inside
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { type: 'f', value: 0 },
                uIntensity: { type: 'f', value: this.options.volumetric.intensity },
                uColor: { type: 'c', value: new THREE.Color(this.options.volumetric.color) },
                uOpacity: { type: 'f', value: this.options.volumetric.opacity },
                uCameraPosition: { type: 'v3', value: new THREE.Vector3() },
                uAudioLevel: { type: 'f', value: 0 }
            },
            vertexShader: [
                'varying vec3 vWorldPosition;',
                'varying vec3 vNormal;',
                'varying float vDistance;',
                'uniform vec3 uCameraPosition;',
                '',
                'void main() {',
                '    vNormal = normalize(normalMatrix * normal);',
                '    vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
                '    vWorldPosition = worldPosition.xyz;',
                '    vDistance = distance(worldPosition.xyz, uCameraPosition);',
                '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform float uTime;',
                'uniform float uIntensity;',
                'uniform vec3 uColor;',
                'uniform float uOpacity;',
                'uniform float uAudioLevel;',
                'varying vec3 vWorldPosition;',
                'varying vec3 vNormal;',
                'varying float vDistance;',
                '',
                '// Simple noise function',
                'float noise(vec3 p) {',
                '    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);',
                '}',
                '',
                '// Smooth noise',
                'float smoothNoise(vec3 p) {',
                '    vec3 i = floor(p);',
                '    vec3 f = fract(p);',
                '    f = f * f * (3.0 - 2.0 * f);',
                '    ',
                '    return mix(',
                '        mix(mix(noise(i), noise(i + vec3(1,0,0)), f.x),',
                '            mix(noise(i + vec3(0,1,0)), noise(i + vec3(1,1,0)), f.x), f.y),',
                '        mix(mix(noise(i + vec3(0,0,1)), noise(i + vec3(1,0,1)), f.x),',
                '            mix(noise(i + vec3(0,1,1)), noise(i + vec3(1,1,1)), f.x), f.y), f.z);',
                '}',
                '',
                'void main() {',
                '    // Create moving volumetric patterns',
                '    vec3 pos = vWorldPosition * 0.003;',
                '    float n1 = smoothNoise(pos + uTime * 0.1);',
                '    float n2 = smoothNoise(pos * 2.0 + uTime * 0.05);',
                '    float n3 = smoothNoise(pos * 4.0 - uTime * 0.02);',
                '    ',
                '    float volumetric = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);',
                '    ',
                '    // Distance-based falloff',
                '    float distanceFalloff = 1.0 - smoothstep(200.0, 600.0, vDistance);',
                '    ',
                '    // Audio reactivity - subtle pulsing',
                '    float audioEffect = 1.0 + uAudioLevel * 0.3;',
                '    ',
                '    // Combine effects',
                '    float alpha = volumetric * uOpacity * distanceFalloff * audioEffect * uIntensity;',
                '    ',
                '    // Subtle color variation',
                '    vec3 color = uColor + vec3(volumetric * 0.1);',
                '    ',
                '    gl_FragColor = vec4(color, alpha);',
                '}'
            ].join('\n')
        });

        // Create mesh
        this.volumetric.mesh = new THREE.Mesh(this.volumetric.geometry, this.volumetric.material);
        this.volumetric.mesh.position.set(0, 50, 0); // Center around the grid area
        
        console.log('Volumetric mesh created:', this.volumetric.mesh);

        // Add to scene
        this.scene.object.add(this.volumetric.mesh);
        console.log('Volumetric lighting added to scene');
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