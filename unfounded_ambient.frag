/*
 * Unfounded - Ambient GLSL Fragment Shader
 *
 * Theme: "Unfounded - Ambient" (Ethereal drifting fog and stardust)
 */

#ifdef GL_ES
precision highp float;
#endif

// --- Uniforms ---
uniform vec2 u_resolution; // Screen resolution (px)
uniform float u_time;      // Time in seconds

// Pseudo-random hash
float hash2d(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Value Noise
float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    float a = hash2d(i + vec2(0.0, 0.0));
    float b = hash2d(i + vec2(1.0, 0.0));
    float c = hash2d(i + vec2(0.0, 1.0));
    float d = hash2d(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 2D fBm (4 Octaves)
float fbm2d(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    int i;
    for (i = 0; i < 4; i++) {
        value += amplitude * noise2d(p * frequency);
        frequency *= 2.2;
        amplitude *= 0.45;
    }
    return value;
}

void main() {
    // --- Variable Declarations ---
    vec2 uv;
    float slowTime;
    vec2 q;
    vec2 r;
    float f;
    vec3 colorBg;
    vec3 colorDeepNavy;
    vec3 colorMagenta;
    vec3 colorNeonCyan;
    vec3 mixFog;
    vec3 finalFog;
    vec3 color;
    float ray;
    vec2 st;
    vec2 ipos;
    vec2 fpos;
    float particleNoise;
    vec2 targetPos;
    float dist;
    float twinkle;
    float size;
    float glowParticle;
    float d_center;
    // --- End of Variable Declarations ---

    // Normalize coordinates (-1.0 to 1.0)
    uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Slow time speed for ambient animation
    slowTime = u_time * 0.06;
    
    // --- 1. Domain Warping for nebulae flow ---
    q = vec2(
        fbm2d(uv + vec2(0.0, slowTime)),
        fbm2d(uv + vec2(3.1, 1.7 + slowTime))
    );
    
    r = vec2(
        fbm2d(uv + 3.0 * q + vec2(1.2, 5.7 + slowTime * 0.4)),
        fbm2d(uv + 3.0 * q + vec2(9.1, 2.3 + slowTime * 0.2))
    );
    
    f = fbm2d(uv + 4.0 * r);
    
    // --- 2. Color Palette (Navy, Magenta, Cyan) ---
    colorBg       = vec3(0.005, 0.004, 0.012); // Space background
    colorDeepNavy = vec3(0.03, 0.05, 0.15);    // Base fog
    colorMagenta  = vec3(0.38, 0.08, 0.35);    // Nebula magenta
    colorNeonCyan = vec3(0.0, 0.5, 0.6);       // Ethereal cyan
    
    mixFog = mix(colorDeepNavy, colorMagenta, clamp(length(q) * 1.2 - 0.2, 0.0, 1.0));
    finalFog = mix(mixFog, colorNeonCyan, clamp(r.x * r.x * 2.5, 0.0, 1.0));
    
    // Combine background and fog
    color = mix(colorBg, finalFog, pow(f, 0.9) * 1.1);
    
    // --- 3. Aurora Light Shafts ---
    ray = sin(uv.x * 1.2 + uv.y * 0.8 + slowTime * 1.5) * 0.5 + 0.5;
    ray *= cos(uv.x * 0.8 - uv.y * 1.0 - slowTime * 0.8) * 0.5 + 0.5;
    color += colorNeonCyan * pow(ray, 4.0) * 0.22;
    
    // --- 4. Drifting Twinkling Particles ---
    st = uv * 4.0;
    st.x += slowTime * 0.15; // Slow drift right
    st.y += sin(slowTime + hash2d(floor(st))) * 0.1; // Float up and down
    
    ipos = floor(st);
    fpos = fract(st);
    
    particleNoise = hash2d(ipos);
    
    if (particleNoise > 0.8) {
        targetPos = vec2(0.5) + vec2(sin(slowTime * 2.0 + particleNoise * 6.28), cos(slowTime * 1.5 + particleNoise * 6.28)) * 0.3;
        dist = length(fpos - targetPos);
        
        // Twinkle effect
        twinkle = sin(u_time * 1.5 + particleNoise * 100.0) * 0.5 + 0.5;
        
        // Glow and outline
        size = 0.015 + (particleNoise - 0.8) * 0.08;
        glowParticle = smoothstep(size, 0.0, dist) * 0.6;
        glowParticle += exp(-dist * 18.0) * 0.4;
        
        color += mix(colorNeonCyan, vec3(0.9, 0.95, 1.0), twinkle) * glowParticle * twinkle * 0.25;
    }
    
    // --- 5. Soft Vignette ---
    d_center = length(uv);
    color *= smoothstep(1.7, 0.6, d_center);
    
    gl_FragColor = vec4(color, 1.0);
}
