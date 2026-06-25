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

// Horizontal scanline shift (row-based corruption)
float rowShift(float y, float seed) {
    float row = floor(y * 32.0);
    float rowRand = hash2(vec2(row, seed));
    if (rowRand > 0.80) {
        return (rowRand - 0.80) * 0.4 * sign(rowRand - 0.90);
    }
    return 0.0;
}

void main() {
    vec2 uv = gl_TexCoord[0].st;

    // Time quantized into frames for sharp glitch steps
    float slowSeed  = floor(u_time * 6.0);
    float fastSeed  = floor(u_time * 18.0);
    float ultraSeed = floor(u_time * 60.0);

    // --- Wavy base distortion (Mojangロゴのぐにゃぐにゃと合わせた雰囲気) ---
    uv.x += sin(uv.y * 14.0 + u_time * 4.5) * 0.018;
    uv.y += cos(uv.x * 10.0 + u_time * 3.5) * 0.012;

    // --- Horizontal row shift (datamosh / scanline corruption) ---
    float shift = rowShift(uv.y, slowSeed) * 0.18;
    // Occasional full-row violent shift
    float violentRow = hash2(vec2(floor(uv.y * 48.0), fastSeed));
    if (violentRow > 0.92) {
        shift += (violentRow - 0.92) * 3.0 - 0.12;
    }

    vec2 shiftedUV = vec2(uv.x + shift, uv.y);

    // --- RGB chromatic aberration split ---
    float aberr = 0.018 + u_event9Active * 0.06;
    float r = texture2D(u_texture, shiftedUV + vec2( aberr, 0.0)).r;
    float g = texture2D(u_texture, shiftedUV                    ).g;
    float b = texture2D(u_texture, shiftedUV - vec2( aberr, 0.0)).b;
    float a = texture2D(u_texture, shiftedUV                    ).a;

    vec3 col = vec3(r, g, b);

    // Darken overall (ominous feel)
    col *= 0.55;

    // --- Blocky pixel corruption (glitch blocks) ---
    float blockSz = 6.0;
    vec2 blockPos = floor(gl_FragCoord.xy / blockSz);
    float blockRand = hash2(blockPos + slowSeed);
    if (blockRand > 0.88) {
        float br2 = hash2(blockPos + slowSeed + 7.0);
        vec3 glitchCol;
        if      (br2 < 0.33) glitchCol = vec3(0.0, 1.0, 1.0);   // cyan
        else if (br2 < 0.66) glitchCol = vec3(1.0, 0.0, 0.8);   // magenta
        else                  glitchCol = vec3(0.2, 1.0, 0.2);   // green
        float mix_amt = clamp((blockRand - 0.88) * 8.0, 0.0, 1.0);
        col = mix(col, glitchCol, mix_amt * 0.7);
    }

    // --- Full scanline color bars (solid corrupted rows) ---
    float lineY = floor(uv.y * 64.0);
    float lineRand = hash2(vec2(lineY, fastSeed));
    if (lineRand > 0.95) {
        float ltype = hash2(vec2(lineY + 1.0, fastSeed));
        vec3 barCol;
        if      (ltype < 0.25) barCol = vec3(1.0, 0.0, 0.0);   // red
        else if (ltype < 0.50) barCol = vec3(0.0, 0.0, 0.0);   // black
        else if (ltype < 0.75) barCol = vec3(0.0, 1.0, 1.0);   // cyan
        else                    barCol = vec3(0.8, 0.0, 1.0);   // purple
        col = mix(col, barCol, 0.85);
    }

    // --- High-freq digital noise overlay ---
    float noiseVal = rand(gl_FragCoord.xy * 0.5 + ultraSeed);
    col += (noiseVal - 0.5) * 0.08;

    // --- Occasional full-screen flash (brief white/color burst) ---
    float flashRand = hash(fastSeed * 0.37);
    if (flashRand > 0.97) {
        float flashStrength = (flashRand - 0.97) * 15.0;
        vec3 flashCol = vec3(
            hash(fastSeed),
            hash(fastSeed + 1.0),
            hash(fastSeed + 2.0)
        );
        col = mix(col, flashCol, clamp(flashStrength * 0.4, 0.0, 0.35));
    }

    // event9 amplification
    if (u_event9Active > 0.0) {
        float ex = u_event9Active;
        col = mix(col, vec3(rand(gl_FragCoord.xy + ultraSeed)), ex * 0.5);
    }

    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
}
