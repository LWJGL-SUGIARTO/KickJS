#ifdef GL_ES
precision highp float;
#endif
varying vec2 vUv;

uniform sampler2D mainTexture;
uniform sampler2D originTexture;

const float BloomAmount = 1.0;

uniform float width;

void main(void)
{
  float dy = 1.0 / width;
  vec4 sum = vec4(0.0);

  sum += texture2D(mainTexture, vUv + vec2(-dy*9.0,0.0)) * 0.016745;
  sum += texture2D(mainTexture, vUv + vec2(-dy*8.0,0.0)) * 0.023526;
  sum += texture2D(mainTexture, vUv + vec2(-dy*7.0,0.0)) * 0.031756;
  sum += texture2D(mainTexture, vUv + vec2(-dy*6.0,0.0)) * 0.041186;
  sum += texture2D(mainTexture, vUv + vec2(-dy*5.0,0.0)) * 0.051320;
  sum += texture2D(mainTexture, vUv + vec2(-dy*4.0,0.0)) * 0.061442;
  sum += texture2D(mainTexture, vUv + vec2(-dy*3.0,0.0)) * 0.070675;
  sum += texture2D(mainTexture, vUv + vec2(-dy*2.0,0.0)) * 0.078108;
  sum += texture2D(mainTexture, vUv + vec2(-dy*1.0,0.0)) * 0.082937;
  sum += texture2D(mainTexture, vUv) * 0.084613;
  sum += texture2D(mainTexture, vUv + vec2(dy*1.0,0.0)) * 0.082937;
  sum += texture2D(mainTexture, vUv + vec2(dy*2.0,0.0)) * 0.078108;
  sum += texture2D(mainTexture, vUv + vec2(dy*3.0,0.0)) * 0.070675;
  sum += texture2D(mainTexture, vUv + vec2(dy*4.0,0.0)) * 0.061442;
  sum += texture2D(mainTexture, vUv + vec2(dy*5.0,0.0)) * 0.051320;
  sum += texture2D(mainTexture, vUv + vec2(dy*6.0,0.0)) * 0.041186;
  sum += texture2D(mainTexture, vUv + vec2(dy*7.0,0.0)) * 0.031756;
  sum += texture2D(mainTexture, vUv + vec2(dy*8.0,0.0)) * 0.023526;
  sum += texture2D(mainTexture, vUv + vec2(dy*9.0,0.0)) * 0.016745;

  gl_FragColor = sum * BloomAmount + texture2D(originTexture, vUv);
}
