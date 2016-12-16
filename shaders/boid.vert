attribute vec3 vertPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 perspective;

void main(void) {
  gl_Position = perspective * view * model * vec4(vertPos, 1.0);
}
