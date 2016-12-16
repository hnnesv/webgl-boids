attribute vec3 vertPos;
attribute vec3 vertNormal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 perspective;

uniform bool lightEnabled;
uniform vec3 lightPos;

varying vec3 normal;
varying vec3 surfaceToLight;
varying vec3 surfaceToZero;

void main(void) {
  vec4 vmVertPos = view * model * vec4(vertPos, 1.0);
  gl_Position = perspective * vmVertPos;

  normal = vertNormal;

  vec4 vLightPos = view * vec4(lightPos, 1.0);
  surfaceToLight = vLightPos.xyz - vmVertPos.xyz;
  surfaceToZero = vec3(0.0, 0.0, 0.0) - vmVertPos.xyz;
}
