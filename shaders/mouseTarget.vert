attribute vec3 vertPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 perspective;

uniform float scale;

void main(void) {
  gl_Position = perspective * view * model * vec4(scale * vertPos, 1.0);
}
