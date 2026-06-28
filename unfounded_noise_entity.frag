#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_event9Active;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_TexCoord[0].st;
    float seed = floor(u_time * 24.0);
    
    // Extreme texture offset (glitch shape distortion)
    float glitchStrength = u_event9Active * 0.9 + 0.2;
    float shift = glitchStrength * 0.35 * (rand(vec2(seed, uv.y)) - 0.5);
    
    // Chromatic aberration sampling
    float r = texture2D(u_texture, uv + vec2(shift, 0.0)).r;
    float g = texture2D(u_texture, uv).g;
    float b = texture2D(u_texture, uv - vec2(shift, 0.0)).b;
    float a = texture2D(u_texture, uv).a;
    
    vec4 baseColor = vec4(r, g, b, a);
    
    // Highly intense color rain noise
    vec3 noiseColor = vec3(
        rand(uv + seed),
        rand(uv + seed + 2.0),
        rand(uv + seed + 4.0)
    );
    
    if (a > 0.0) {
        // Blend color noise, hide base texture completely as event9Active approaches 1.0
        float mixVal = clamp(0.5 + u_event9Active * 0.5, 0.0, 1.0);
        vec3 finalColor = mix(baseColor.rgb, noiseColor, mixVal);
        
        // Completely override with color noise when closer
        if (u_event9Active > 0.4) {
            float extremeMix = clamp((u_event9Active - 0.4) * 2.0, 0.0, 1.0);
            finalColor = mix(finalColor, noiseColor, extremeMix);
        }
        
        gl_FragColor = vec4(finalColor, a);
    } else {
        // Leaking glitch particles around the borders (increased probability)
        float alphaNoise = rand(uv + seed);
        if (alphaNoise > 0.97 - 0.15 * u_event9Active) {
            gl_FragColor = vec4(noiseColor, 0.85);
        } else {
            gl_FragColor = vec4(0.0);
        }
    }
}
