#ifdef GL_ES
precision highp float;
#endif

// --- Uniforms ---
uniform vec2 u_resolution;   // Screen resolution (px)
uniform float u_time;        // Time in seconds
uniform vec2 u_mouse;        // Mouse coordinates
uniform sampler2D u_texture; // Captured screen texture (Background + UI)
uniform sampler2D u_bgTexture; // Background-only texture
uniform vec2 u_texScale;     // Texture scale factor
uniform int u_isMenu;        // 2 if GuiMainMenu, 1 if other menus, 0 if in-game
uniform float u_event2Active; // 0.0 to 1.0 (strength of event2)
uniform float u_event3Active; // 0.0 to 1.0 (strength of event3)
uniform float u_event3Time;   // elapsed time for event3 in seconds
uniform float u_event6Active; // 0.0 to 1.0 (strength of event6)
uniform float u_event7Active; // 0.0 to 1.0 (strength of event7)
uniform float u_event0Active; // 0.0 or 1.0 (event0 active flag)
uniform float u_event1Active; // 0.0 or 1.0 (event1 active flag)
uniform float u_event9Active; // 0.0 to 1.0 (strength of event9)
uniform float u_glitchScale;  // 0.0 = Off, 0.2 = Weak, 1.0 = Normal

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
        strength = max(strength, fract(hashVal * 100.0) * 0.9);
    }
    
    return strength;
}

// 2D Cross product for triangle hit test
float cross2d(vec2 u, vec2 v) {
    return u.x * v.y - u.y * v.x;
}

// Triangle hit test
bool inTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
    float d1 = cross2d(b - a, p - a);
    float d2 = cross2d(c - b, p - b);
    float d3 = cross2d(a - c, p - c);
    
    bool has_neg = (d1 < 0.0) || (d2 < 0.0) || (d3 < 0.0);
    bool has_pos = (d1 > 0.0) || (d2 > 0.0) || (d3 > 0.0);
    
    return !(has_neg && has_pos);
}

void main() {
    // --- Variable Declarations ---
    vec2 screenUV;
    float strength;
    float gSeed;
    bool isGUI;
    vec2 jitteredUV;
    
    // Helper colors
    vec3 bgColor;
    vec3 origScreenColor;
    float diff;
    
    // Event 3 variables
    vec2 uvCenter;
    vec2 relUV;
    float aspect;
    float omega0;
    float duration;
    float t;
    float angle;
    float cosA;
    float sinA;
    vec2 rotatedUV;
    float zoom;
    
    // Event 2 variables
    float waveX;
    float waveY;
    float distScale;
    
    // Event 6 variables
    float distToCenter;
    float swirlAngle;
    float cosS;
    float sinS;
    vec2 swirlUV;
    float maxSwirlAngle;
    
    // Event 7 variables
    vec2 pt0;
    vec2 pt1;
    vec2 pt2;
    float swirlAngle7;
    float cosS7;
    float sinS7;
    vec2 r0_7;
    vec2 r1_7;
    vec2 r2_7;
    vec2 v0_7;
    vec2 v1_7;
    vec2 v2_7;
    float size7;
    float noiseT;
    
    // Flip variables
    float flipRand;
    
    // Analog Sync Drift variables
    float wave;
    float waveScale;
    float rollSeed;
    float rollThreshold;
    float rollOffset;
    
    // Rolling Tracking Bar variables
    float rollY;
    float distToRoll;
    float factor;
    float shiftScale;
    float noiseMix;
    
    // Slice Jitter variables
    float numSlices;
    float sliceId;
    float sliceRand;
    float sliceThreshold;
    float shiftX;
    float sliceShiftScale;
    
    // Sampling & Chromatic Aberration variables
    vec3 color;
    float CA_splitScale;
    float CA_splitAmount;
    float CA_splitDir;
    
    // Digital Color Glitch variables
    float numHoriz;
    float numVert;
    vec2 blockGrid;
    float blockRand;
    float invRand;
    
    // Noise overlay variables
    float baseMono;
    float glitchMono;
    float monoVal;
    float baseColorNoise;
    float glitchColorNoise;
    vec3 colNoise;
    float blockVal;
    
    // Scanline variables
    float scanlineSpeed;
    float scanlineStrength;
    float scanline;
    // --- End of Variable Declarations ---

    // --- Initialization ---
    screenUV = (gl_FragCoord.xy / u_resolution.xy) * u_texScale;
    strength = getGlitchStrength(u_time) * u_glitchScale;
    if (u_event2Active > 0.0) {
        strength = max(strength, u_event2Active * 0.95);
    }
    if (u_event3Active > 0.0) {
        strength = max(strength, u_event3Active * 0.4);
    }
    if (u_event0Active > 0.0) {
        strength = max(strength, 0.90);
    }
    if (u_event1Active > 0.0) {
        strength = max(strength, 0.95);
    }
    gSeed = floor(u_time * 24.0);
    
    isGUI = false;
    if (u_isMenu >= 1) {
        bgColor = texture2D(u_bgTexture, screenUV).rgb;
        origScreenColor = texture2D(u_texture, screenUV).rgb;
        diff = length(origScreenColor - bgColor);
        isGUI = diff > 0.04;
    }
    
    jitteredUV = screenUV;

    // --- Event 3 Rotation (Screen Rotation & Zoom) ---
    if (u_event3Active > 0.0) {
        uvCenter = 0.5 * u_texScale;
        relUV = jitteredUV - uvCenter;
        
        aspect = u_resolution.x / u_resolution.y;
        relUV.x *= aspect;
        
        // Decelerating rotation model (theta(t) = omega0 * (t - t^2 / (2 * D)))
        omega0 = 4.5;
        duration = 6.0;
        t = u_event3Time;
        angle = omega0 * (t - (t * t) / (2.0 * duration));
        
        cosA = cos(angle);
        sinA = sin(angle);
        
        rotatedUV.x = relUV.x * cosA - relUV.y * sinA;
        rotatedUV.y = relUV.x * sinA + relUV.y * cosA;
        
        rotatedUV.x /= aspect;
        jitteredUV = rotatedUV + uvCenter;
        
        // Zoom in to hide black corners during rotation
        zoom = 1.0 + 0.5 * u_event3Active;
        jitteredUV = (jitteredUV - uvCenter) / zoom + uvCenter;
    }

    // --- Event 6 Swirl (Screen twisting / spiral) ---
    if (u_event6Active > 0.0) {
        uvCenter = 0.5 * u_texScale;
        relUV = jitteredUV - uvCenter;
        
        aspect = u_resolution.x / u_resolution.y;
        relUV.x *= aspect;
        
        distToCenter = length(relUV);
        
        maxSwirlAngle = 12.5 * u_event6Active;
        swirlAngle = maxSwirlAngle * (1.0 - smoothstep(0.0, 0.8, distToCenter));
        
        cosS = cos(swirlAngle);
        sinS = sin(swirlAngle);
        
        swirlUV.x = relUV.x * cosS - relUV.y * sinS;
        swirlUV.y = relUV.x * sinS + relUV.y * cosS;
        
        swirlUV.x /= aspect;
        jitteredUV = swirlUV + uvCenter;
    }

    // --- Event 2 Flip & Distortion (Wavy Distortion & Upside Down) ---
    if (u_event2Active > 0.0) {
        jitteredUV.y = u_texScale.y - jitteredUV.y;
        waveX = sin(screenUV.y * 15.0 + u_time * 12.0) * cos(screenUV.y * 8.0 - u_time * 6.0);
        waveY = cos(screenUV.x * 15.0 + u_time * 12.0) * sin(screenUV.x * 8.0 - u_time * 6.0);
        distScale = 0.06 * u_event2Active;
        jitteredUV.x += waveX * distScale * u_texScale.x;
        jitteredUV.y += waveY * distScale * u_texScale.y;
    }
    
    // --- 2. Screen Flip (GuiMainMenu Home screen only, during intense spikes) ---
    if (u_isMenu == 2 && strength > 0.65) {
        flipRand = hash(vec2(gSeed, 33.3));
        if (flipRand > 0.75) {
            jitteredUV.y = u_texScale.y - jitteredUV.y;
        } else if (flipRand > 0.50) {
            jitteredUV.x = u_texScale.x - jitteredUV.x;
        } else if (flipRand > 0.25) {
            jitteredUV = u_texScale - jitteredUV;
        }
    }
    
    // --- 3. Analog Sync Drift & Vertical Roll ---
    if (strength > 0.1) {
        // Horizontal wave wobble (CRT sync drift)
        wave = sin(screenUV.y * 40.0 + u_time * 30.0) * cos(screenUV.y * 12.0 - u_time * 15.0);
        waveScale = (u_isMenu >= 1) ? 0.005 : 0.003;
        if (isGUI) {
            waveScale *= 1.5;
        }
        jitteredUV.x += wave * waveScale * strength * u_texScale.x;
        
        // Vertical jump/roll (occasional tracking loss)
        rollSeed = hash(vec2(gSeed, 99.9));
        rollThreshold = (u_isMenu >= 1) ? 0.82 : 0.88;
        if (rollSeed > rollThreshold * (1.0 - strength)) {
            rollOffset = fract(u_time * 0.4) * strength * 0.15;
            jitteredUV.y = fract(jitteredUV.y + rollOffset);
        }
    }
    
    // --- 4. Rolling Tracking Bar (Horizontal wiggle) ---
    rollY = fract(u_time * 0.15) * u_texScale.y;
    distToRoll = abs(jitteredUV.y - rollY);
    if (distToRoll < 0.12 * u_texScale.y) {
        factor = 1.0 - (distToRoll / (0.12 * u_texScale.y));
        shiftScale = (u_isMenu >= 1) ? 0.012 : 0.007;
        jitteredUV.x += sin(jitteredUV.y * 80.0 + u_time * 50.0) * shiftScale * factor * strength * u_texScale.x;
    }
    
    // --- 5. Screen-Space Horizontal Slice Jitter ---
    if (strength > 0.18) {
        numSlices = 30.0 + hash(vec2(gSeed, 11.1)) * 40.0;
        sliceId = floor(jitteredUV.y / u_texScale.y * numSlices);
        sliceRand = hash(vec2(sliceId, gSeed));
        
        sliceThreshold = 1.0 - (0.08 + strength * 0.42);
        if (sliceRand > sliceThreshold) {
            shiftX = hash(vec2(sliceId, gSeed + 2.7)) - 0.5;
            sliceShiftScale = (u_isMenu >= 1) ? 0.075 : 0.045;
            if (isGUI) {
                sliceShiftScale *= 1.8;
            }
            jitteredUV.x += shiftX * sliceShiftScale * strength * u_texScale.x;
        }
    }
    
    // --- 6. Sampling & Chromatic Aberration ---
    if (strength > 0.15) {
        CA_splitScale = (u_isMenu >= 1) ? 0.035 : 0.022;
        if (isGUI) {
            CA_splitScale *= 1.6;
        }
        CA_splitAmount = (0.003 + strength * CA_splitScale) * u_texScale.x;
        CA_splitDir = sign(hash(vec2(gSeed, 12.34)) - 0.5);
        
        color.r = texture2D(u_texture, jitteredUV + vec2(CA_splitAmount * CA_splitDir, 0.0)).r;
        color.g = texture2D(u_texture, jitteredUV).g;
        color.b = texture2D(u_texture, jitteredUV - vec2(CA_splitAmount * CA_splitDir, 0.0)).b;
    } else {
        color = texture2D(u_texture, jitteredUV).rgb;
    }
    
    // Mix static noise inside rolling tracking bar
    if (distToRoll < 0.12 * u_texScale.y) {
        factor = 1.0 - (distToRoll / (0.12 * u_texScale.y));
        if (rand(gl_FragCoord.xy + gSeed) > 0.70) {
            noiseMix = (u_isMenu >= 1) ? 0.35 : 0.20;
            color = mix(color, vec3(rand(gl_FragCoord.xy + gSeed + 9.9)), noiseMix * factor * (0.3 + strength * 0.7));
        }
    }
    
    // --- Event 7 Triangle Object ---
    if (u_event7Active > 0.0) {
        uvCenter = 0.5 * u_texScale;
        size7 = 0.20 * u_event7Active;
        v0_7 = vec2(0.0, 1.0) * size7;
        v1_7 = vec2(-0.866, -0.5) * size7;
        v2_7 = vec2(0.866, -0.5) * size7;
        
        aspect = u_resolution.x / u_resolution.y;
        swirlAngle7 = -u_time * 2.8;
        cosS7 = cos(swirlAngle7);
        sinS7 = sin(swirlAngle7);
        
        r0_7.x = v0_7.x * cosS7 - v0_7.y * sinS7;
        r0_7.y = v0_7.x * sinS7 + v0_7.y * cosS7;
        r1_7.x = v1_7.x * cosS7 - v1_7.y * sinS7;
        r1_7.y = v1_7.x * sinS7 + v1_7.y * cosS7;
        r2_7.x = v2_7.x * cosS7 - v2_7.y * sinS7;
        r2_7.y = v2_7.x * sinS7 + v2_7.y * cosS7;
        
        r0_7.x /= aspect;
        r1_7.x /= aspect;
        r2_7.x /= aspect;
        
        pt0 = uvCenter + r0_7;
        pt1 = uvCenter + r1_7;
        pt2 = uvCenter + r2_7;
        
        if (inTriangle(screenUV, pt0, pt1, pt2)) {
            noiseT = rand(gl_FragCoord.xy + floor(u_time * 24.0));
            color = mix(color, mix(vec3(1.0) - color, vec3(noiseT), 0.4), 0.90);
        }
    }
    
    // --- 7. Block-wise Digital Color Glitch & Inversion ---
    if (strength > 0.3) {
        numHoriz = 6.0 + hash(vec2(gSeed, 5.5)) * 8.0;
        numVert = 36.0 + hash(vec2(gSeed, 6.6)) * 24.0;
        blockGrid = floor(screenUV * vec2(numHoriz, numVert));
        blockRand = hash(blockGrid + gSeed);
        if (blockRand > 0.92) {
            if (hash(blockGrid - gSeed) > 0.5) {
                color.r = mix(color.r, 1.0 - color.r, 0.35);
                color.b = mix(color.b, 1.0, 0.25);
            } else {
                color.g = mix(color.g, 1.0 - color.g, 0.35);
                color.r = mix(color.r, 1.0, 0.25);
            }
        }
        
        // Full screen channel swap / inversion during massive spikes
        if (strength > 0.75) {
            invRand = hash(vec2(gSeed, 77.7));
            if (invRand > 0.85) {
                color = mix(color, vec3(1.0) - color, 0.25);
            } else if (invRand > 0.70) {
                color = color.gbr;
            }
        }
    }
    
    // --- 8. Noise Overlays ---
    // A. MONOCHROME NOISE (Grain) - Always present but spikes during glitches
    baseMono = (u_isMenu >= 1) ? 0.06 : 0.035;
    glitchMono = strength * ((u_isMenu >= 1) ? 0.20 : 0.12);
    monoVal = rand(gl_FragCoord.xy + gSeed);
    color += vec3((monoVal - 0.5) * (baseMono + glitchMono) * u_glitchScale);
    
    // B. COLOR NOISE (RGB Static) - GUI only, spikes during glitches
    if (isGUI) {
        baseColorNoise = 0.08;
        glitchColorNoise = strength * 0.25;
        colNoise = vec3(
            rand(gl_FragCoord.xy + gSeed + 1.23),
            rand(gl_FragCoord.xy + gSeed + 4.56),
            rand(gl_FragCoord.xy + gSeed + 7.89)
        );
        color += (colNoise - 0.5) * (baseColorNoise + glitchColorNoise) * u_glitchScale;
        
        // --- C. GUI / TEXT DISSOLVE GLITCH ---
        if (strength > 0.25) {
            blockVal = hash(floor(gl_FragCoord.xy / 6.0) + gSeed);
            if (blockVal > 1.0 - (strength * 0.28)) {
                color = texture2D(u_bgTexture, screenUV).rgb;
            }
        }
    }
    
    // --- 9. Retro CRT Scanlines ---
    scanlineSpeed = 8.0 + strength * 20.0;
    scanlineStrength = (u_isMenu >= 1) ? 
        (0.035 + strength * 0.05) : 
        (0.018 + strength * 0.03);
    scanline = sin(gl_FragCoord.y * 0.52 - u_time * scanlineSpeed) * scanlineStrength * u_glitchScale;
    color -= vec3(scanline);
    
    // --- Event 9 Glitch Noise (Color Rain / Error Noise) ---
    if (u_event9Active > 0.0) {
        float seed = floor(u_time * 24.0);
        
        // Intense screen displacement / shake
        float shiftX = 0.15 * u_event9Active * (rand(vec2(seed, screenUV.y)) - 0.5);
        float shiftY = 0.08 * u_event9Active * (rand(vec2(screenUV.x, seed)) - 0.5);
        
        vec3 col;
        col.r = texture2D(u_texture, screenUV + vec2(shiftX, shiftY)).r;
        col.g = texture2D(u_texture, screenUV).g;
        col.b = texture2D(u_texture, screenUV - vec2(shiftX, shiftY)).b;
        
        // Blocky colorful noise overlays
        float blockS = 8.0 + (1.0 - u_event9Active) * 32.0;
        vec2 blockGrid = floor(gl_FragCoord.xy / blockS);
        vec3 randCol = vec3(
            rand(blockGrid + seed),
            rand(blockGrid + seed + 2.0),
            rand(blockGrid + seed + 4.0)
        );
        
        color = mix(col, randCol, 0.45 * u_event9Active);
        
        // Red error horizontal lines
        float lineNoise = rand(vec2(seed, screenUV.y * 100.0));
        if (lineNoise > 1.0 - 0.15 * u_event9Active) {
            color = mix(color, vec3(1.0, 0.0, 0.0), 0.7);
        }
    }
    
    gl_FragColor = vec4(color, 1.0);
}
