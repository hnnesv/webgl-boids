attribute vec3 vertPos;
attribute vec3 boidP;
attribute vec3 boidV;

uniform mat4 view;
uniform mat4 perspective;


// thanks to http://www.neilmendoza.com/glsl-rotation-about-an-arbitrary-axis/
mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  
  return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
              oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
              oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
              0.0,                                0.0,                                0.0,                                1.0);
}

void main(void) {
  vec3 yAxis = vec3(0.0, 1.0, 0.0);
  vec3 axis = cross(boidV, yAxis);
  float cosine = dot(boidV, yAxis);
  mat4 rot = rotationMatrix(axis, acos(cosine));

  mat4 translate = mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    boidP.x, boidP.y, boidP.z, 1.0
  );

  gl_Position = perspective * view * translate * rot * vec4(vertPos, 1.0);
}
