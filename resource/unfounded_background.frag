#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_event9Active;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec2 uv = gl_TexCoord[0].st;
    vec2 shiftedUV = uv;

    // Time quantized into rapid, violent steps (15 updates per second)
    float timeStep = floor(u_time * 15.0);
    float glitchChance = hash(timeStep);

    // Hashed time offsets to completely prevent linear scrolling/flowing of the grids.
    // Adding random jumps (hashes) to grid coordinates rather than linear timeStep forces blocks to jump, not slide.
    float tHash1 = hash(timeStep);
    float tHash2 = hash(timeStep + 1.11);
    vec2 tOffset = vec2(tHash1, tHash2) * 100.0;

    // --- 1. Macro Screen Splits (Extreme screen breaks in screen-space) ---
    // Breaks the screen in half or sections based on screen pixels so it does not flow
    if (glitchChance > 0.50) {
        float splitY = hash(timeStep + 99.1) * 1080.0;
        if (gl_FragCoord.y > splitY) {
            shiftedUV.x += (hash(timeStep + 88.2) - 0.5) * 0.45;
        }
        
        float splitX = hash(timeStep + 77.3) * 1920.0;
        if (gl_FragCoord.x > splitX) {
            shiftedUV.y += (hash(timeStep + 66.4) - 0.5) * 0.45;
        }
    }

    // --- 2. Violent Screen Jitter / High-freq vibration ---
    if (glitchChance > 0.65) {
        float shakeAmt = 0.04 + 0.06 * hash(timeStep + 0.88);
        shiftedUV.x += (hash(timeStep + 0.12) - 0.5) * shakeAmt;
        shiftedUV.y += (hash(timeStep + 0.45) - 0.5) * shakeAmt;
    }

    // --- 3. Heavy Block Datamoshing (Screen-space grid displacement) ---
    // Using a screen-space grid of 80x80 pixels.
    vec2 blockGrid = floor(gl_FragCoord.xy / 80.0);
    float blockDisplaceSeed = hash2(blockGrid + tOffset);
    
    if (glitchChance > 0.30 && blockDisplaceSeed > 0.65) {
        vec2 offset = vec2(
            hash2(blockGrid + tOffset + vec2(1.23, 4.56)) - 0.5,
            hash2(blockGrid + tOffset + vec2(7.89, 0.12)) - 0.5
        );
        // Extremely massive shift amount (up to 35% texture shift)
        shiftedUV += offset * (0.15 + 0.35 * hash2(blockGrid + tOffset + vec2(5.55)));
    }

    // --- 4. Dynamic Chromatic Aberration (Extreme RGB splitting) ---
    float aberr = 0.0;
    if (glitchChance > 0.4) {
        aberr = 0.015 + 0.045 * hash(timeStep + 9.87) + u_event9Active * 0.08;
    }

    // Even more extreme CA for certain blocks on the screen
    if (hash2(blockGrid + tOffset + vec2(9.99)) > 0.75) {
        aberr *= 3.5;
    }

    float r = texture2D(u_texture, shiftedUV + vec2(aberr, 0.0)).r;
    float g = texture2D(u_texture, shiftedUV).g;
    float b = texture2D(u_texture, shiftedUV - vec2(aberr, 0.0)).b;
    float a = texture2D(u_texture, shiftedUV).a;

    vec3 col = vec3(r, g, b);

    // Darken overall (ominous feel)
    col *= 0.55;

    // --- 5. Block-based Digital Corruption & Pure Static Blocks ---
    vec2 colorBlockId = floor(gl_FragCoord.xy / 24.0);
    float colorBlockSeed = hash2(colorBlockId + tOffset + vec2(12.34));
    
    if (glitchChance > 0.45 && colorBlockSeed > 0.75) {
        float type = hash2(colorBlockId + tOffset + vec2(56.78));
        if (type < 0.25) {
            // Full color inversion
            col = vec3(1.0) - col;
        } else if (type < 0.50) {
            // Channel swapping
            col = col.gbr;
        } else if (type < 0.75) {
            // Neon pink/purple corruption
            col = mix(col, vec3(0.9, 0.0, 0.9), 0.85);
        } else {
            // Replace block completely with analog white noise/static
            float staticNoise = rand(gl_FragCoord.xy + tOffset);
            col = vec3(staticNoise);
        }
    }

    // --- 6. High-frequency flickering noise overlay ---
    float noiseVal = rand(gl_FragCoord.xy * 0.8 + tOffset);
    col += (noiseVal - 0.5) * 0.14;

    // --- 7. Rapid Full-screen Burst Flashes ---
    float burstChance = hash(timeStep * 7.12);
    if (burstChance > 0.90) {
        float burstType = hash(timeStep + 5.5);
        vec3 burstCol;
        if (burstType < 0.33) {
            // Pure white burst
            burstCol = vec3(1.0);
        } else if (burstType < 0.66) {
            // Solid red warning burst
            burstCol = vec3(0.8, 0.0, 0.0);
        } else {
            // Inverted full screen flash
            burstCol = vec3(1.0) - col;
        }
        col = mix(col, burstCol, 0.45);
    }

    // event9 amplification
    if (u_event9Active > 0.0) {
        float ex = u_event9Active;
        col = mix(col, vec3(rand(gl_FragCoord.xy + tOffset * 2.0)), ex * 0.7);
    }

    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
}
