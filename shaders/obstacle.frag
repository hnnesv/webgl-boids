precision mediump float;

uniform vec4 modelColor;

uniform bool lightEnabled;
uniform float lightScale;

varying vec3 normal;
varying vec3 surfaceToLight;
varying vec3 surfaceToZero;

void main(void) {
  float lightFactor = 0.0;
  if (lightEnabled) {
    lightFactor = dot(normalize(normal), normalize(surfaceToLight));
  }

  float zeroLightFactor = dot(normalize(normal), normalize(surfaceToZero));

  gl_FragColor = vec4(0.5 * modelColor.rgb, modelColor.a);
  gl_FragColor.rgb += 0.25 * zeroLightFactor * modelColor.rgb;
  gl_FragColor.rgb += 0.25 * lightScale * lightFactor * modelColor.rgb;
}
