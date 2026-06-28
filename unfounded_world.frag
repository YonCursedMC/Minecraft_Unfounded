#ifdef GL_ES
precision highp float;
#endif

// --- Uniforms ---
uniform vec2 u_resolution;   // Screen resolution (px)
uniform float u_time;        // Time in seconds
uniform sampler2D u_texture; // Currently bound texture (Terrain or Mob)
uniform sampler2D u_lightmap; // Currently bound lightmap texture

// Pseudo-random hash function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D noise generator for static grain
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// Erratic time-based glitch strength generator (returns 0.0 to 1.0)
float getGlitchStrength(float time) {
    float t = time * 3.2; // Speed up time progression slightly
    // Multi-frequency wave combination to create chaotic, non-periodic behavior
    float envelope = sin(t * 0.23) * cos(t * 0.11) * sin(t * 0.05) * 2.0;
    float noise = sin(t * 12.7) * cos(t * 23.3) * sin(t * 47.1);
    float combined = envelope * 0.6 + noise * 0.4;
    
    // Most of the time the screen is completely clean (strength = 0.0)
    float strength = smoothstep(0.15, 0.75, combined);
    
    // Add sudden, extremely sharp, short spikes (1-3 frames) using a time-hash
    float frameId = floor(time * 20.0); // 20 updates per second
    float hashVal = fract(sin(frameId * 782.13) * 43758.5453);
    
    // 10% chance of a sudden random spike that overrides standard strength
    if (hashVal > 0.90) {
        strength = max(strength, fract(hashVal * 100.0) * 0.8);
    }
    
    return strength;
}

void main() {
    // --- Variable Declarations ---
    vec2 uv;
    float strength;
    vec2 jitteredUV;
    float splitAmount;
    float splitDir;
    
    // Analog Sync Drift / Slice variables
    float screenY;
    float gSeed;
    float rollY;
    float distToRoll;
    float factor;
    float numSlices;
    float sliceId;
    float sliceTime;
    float sliceRand;
    float threshold;
    float shiftX;
    float CASeed;
    
    // Texture sampling variables
    vec4 texColor;
    
    // Noise overlay variables
    float monoVal;
    float baseMono;
    float glitchMono;
    vec3 colNoise;
    vec2 screenUV;
    float numHoriz;
    float numVert;
    vec2 blockGrid;
    float tintSeed;
    // --- End of Variable Declarations ---

    // Get the original texture coordinates of the polygon face
    uv = gl_TexCoord[0].st;
    
    // --- 1. Get Glitch Strength ---
    strength = getGlitchStrength(u_time);
    
    jitteredUV = uv;
    splitAmount = 0.0;
    splitDir = 1.0;
    
    // --- 2. Jitter, Slicing and Rolling Tracking Bar ---
    if (strength > 0.1) {
        screenY = gl_FragCoord.y / u_resolution.y;
        gSeed = floor(u_time * 24.0);
        
        // A. Rolling Tracking Bar (Horizontal wiggle)
        rollY = fract(u_time * 0.12);
        distToRoll = abs(screenY - rollY);
        if (distToRoll < 0.10) {
            factor = 1.0 - (distToRoll / 0.10);
            // Shift block texture UV
            jitteredUV.x += sin(screenY * 100.0 + u_time * 40.0) * 0.003 * factor * strength;
        }
        
        // B. Screen-Space Slice Jitter (Tearing across blocks)
        numSlices = 24.0 + hash(vec2(floor(u_time * 12.0), 3.3)) * 24.0;
        sliceId = floor(screenY * numSlices);
        sliceTime = floor(u_time * 15.0);
        sliceRand = hash(vec2(sliceId, sliceTime));
        
        // More active slicing
        threshold = 1.0 - (0.08 + strength * 0.28);
        if (sliceRand > threshold) {
            shiftX = hash(vec2(sliceId, sliceTime + 4.4)) - 0.5;
            // Shift UV coordinates (up to 0.008, safe but noticeable)
            jitteredUV.x += shiftX * 0.008 * strength;
        }
        
        // C. Chromatic Aberration
        CASeed = hash(vec2(floor(u_time * 15.0), 55.5));
        splitAmount = (0.0005 + pow(CASeed, 2.0) * 0.004) * strength;
        splitDir = sign(hash(vec2(floor(u_time * 15.0), 22.2)) - 0.5);
    }
    
    // --- 3. Sampling and Chromatic Aberration ---
    if (strength > 0.1) {
        texColor.r = texture2D(u_texture, jitteredUV + vec2(splitAmount * splitDir, 0.0)).r;
        texColor.g = texture2D(u_texture, jitteredUV).g;
        texColor.b = texture2D(u_texture, jitteredUV - vec2(splitAmount * splitDir, 0.0)).b;
        texColor.a = texture2D(u_texture, jitteredUV).a; // Keep alpha channel intact
    } else {
        texColor = texture2D(u_texture, jitteredUV);
    }
    
    // --- 4. Noise and Surface Glitches ---
    if (texColor.a > 0.1) {
        gSeed = floor(u_time * 24.0);
        monoVal = rand(gl_FragCoord.xy + gSeed);
        
        // Stronger grain in-game (4% base, up to 12% in glitches)
        baseMono = 0.04;
        glitchMono = strength * 0.08;
        texColor.rgb += vec3((monoVal - 0.5) * (baseMono + glitchMono));
        
        if (strength > 0.3) {
            // Color noise overlay
            colNoise = vec3(
                rand(gl_FragCoord.xy + gSeed + 1.23),
                rand(gl_FragCoord.xy + gSeed + 4.56),
                rand(gl_FragCoord.xy + gSeed + 7.89)
            );
            texColor.rgb += (colNoise - 0.5) * (0.05 + strength * 0.11);
            
            // Block-wise color glitch (horizontally elongated rectangular grid)
            screenUV = gl_FragCoord.xy / u_resolution.xy;
            numHoriz = 6.0 + hash(vec2(gSeed, 8.8)) * 8.0;   // 6 to 14 horizontal blocks
            numVert = 36.0 + hash(vec2(gSeed, 9.9)) * 24.0;  // 36 to 60 vertical blocks
            blockGrid = floor(screenUV * vec2(numHoriz, numVert));
            tintSeed = hash(blockGrid + gSeed);
            if (tintSeed > 0.93) {
                if (hash(blockGrid - gSeed) > 0.5) {
                    texColor.r = mix(texColor.r, 1.0 - texColor.r, 0.20);
                    texColor.b = mix(texColor.b, 1.0, 0.15);
                } else {
                    texColor.g = mix(texColor.g, 1.0 - texColor.g, 0.20);
                    texColor.r = mix(texColor.r, 1.0, 0.15);
                }
            }
        }
    }
    
    // Multiply by vertex color and lightmap color to retain lighting (day/night, torches, shadow)
    vec4 lightmapColor = texture2D(u_lightmap, gl_TexCoord[1].st);
    gl_FragColor = texColor * lightmapColor * gl_Color;
}
