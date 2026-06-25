#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_event9Active;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec2 uv = gl_TexCoord[0].st;
    float seed = floor(u_time * 18.0);
    
    // Baseline ambient glitching (flashing static)
    float baseGlitch = 0.035;
    float spike = hash(vec2(seed, 13.5));
    if (spike > 0.95) {
        baseGlitch = 0.22 * fract(spike * 100.0);
    }
    
    // Total glitch combines baseline ambient and active event9 strength
    float totalGlitch = clamp(baseGlitch + u_event9Active * 0.85, 0.0, 1.0);
    
    // Screen UV distortion
    float shiftX = totalGlitch * 0.12 * (rand(vec2(seed, uv.y)) - 0.5);
    float shiftY = totalGlitch * 0.04 * (rand(vec2(uv.x, seed)) - 0.5);
    
    // Chromatic aberration texture sampling
    float r = texture2D(u_texture, uv + vec2(shiftX, shiftY)).r;
    float g = texture2D(u_texture, uv).g;
    float b = texture2D(u_texture, uv - vec2(shiftX, shiftY)).b;
    float a = texture2D(u_texture, uv).a;
    
    vec4 baseColor = vec4(r, g, b, a);
    
    // Blocky noise color overlays
    float blockS = max(4.0, 16.0 - totalGlitch * 12.0);
    vec2 blockGrid = floor(gl_FragCoord.xy / blockS);
    vec3 noiseColor = vec3(
        rand(blockGrid + seed),
        rand(blockGrid + seed + 2.0),
        rand(blockGrid + seed + 4.0)
    );
    
    // Blend colorful noise on top of dirt texture
    vec3 finalColor = mix(baseColor.rgb, noiseColor, totalGlitch * 0.45);
    
    // Force complete color rain noise if glitch is extreme
    if (totalGlitch > 0.5) {
        float extremeMix = clamp((totalGlitch - 0.5) * 2.0, 0.0, 1.0);
        finalColor = mix(finalColor, noiseColor, extremeMix);
    }
    
    // Vertical scanline colored bars
    float lineNoise = rand(vec2(seed, uv.y * 10.0));
    if (lineNoise > 1.0 - 0.08 * totalGlitch) {
        finalColor = mix(finalColor, vec3(1.0, 0.0, 0.0), 0.65);
    }
    
    gl_FragColor = vec4(finalColor, a);
}
