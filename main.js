'use strict'
const boidVert = require('./shaders/boid.vert')
const boidFrag = require('./shaders/boid.frag')
const obstacleVert = require('./shaders/obstacle.vert')
const obstacleFrag = require('./shaders/obstacle.frag')
const mouseTargetVert = require('./shaders/mouseTarget.vert')
const mouseTargetFrag = require('./shaders/mouseTarget.frag')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
const vec4 = require('gl-vec4')
const Flock = require('./flock')
const URI = require('urijs')

let canvas
let gl

let boidShaderProgram
let obstacleShaderProgram
let mouseTargetShaderProgram

let boidBuffer
let obstacleBuffer
let obstacleNormalsBuffer
let targetBuffer

let model = mat4.create()
let view = mat4.create()
let perspective = mat4.create()
let pvInverse = mat4.create()

let flock

let mouseX = 0.0
let mouseY = 0.0
let mouseCoord = vec3.create()
let mouseDown = false
let mouseUp = false

const VIEW_Z = -12.0
const Y_AXIS = vec3.fromValues(0.0, 1.0, 0.0)

function compileShader (type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source())
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    throw new Error('Shader compilation error: ' + gl.getShaderInfoLog(shader))
  }

  return shader
}

function createShaderProgram (vert, frag) {
  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, compileShader(gl.VERTEX_SHADER, vert))
  gl.attachShader(shaderProgram, compileShader(gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
  }

  gl.bindAttribLocation(shaderProgram, 0, 'vertPos')
  shaderProgram.vertPos = gl.getAttribLocation(shaderProgram, 'vertPos')

  shaderProgram.perspective = gl.getUniformLocation(shaderProgram, 'perspective')
  shaderProgram.view = gl.getUniformLocation(shaderProgram, 'view')
  shaderProgram.model = gl.getUniformLocation(shaderProgram, 'model')
  shaderProgram.modelColor = gl.getUniformLocation(shaderProgram, 'modelColor')

  return shaderProgram
}

function initShaderPrograms () {
  boidShaderProgram = createShaderProgram(boidVert, boidFrag)

  obstacleShaderProgram = createShaderProgram(obstacleVert, obstacleFrag)
  gl.bindAttribLocation(obstacleShaderProgram, 1, 'vertNormal')
  obstacleShaderProgram.vertNormal = gl.getAttribLocation(obstacleShaderProgram, 'vertNormal')
  obstacleShaderProgram.lightPos = gl.getUniformLocation(obstacleShaderProgram, 'lightPos')
  obstacleShaderProgram.lightEnabled = gl.getUniformLocation(obstacleShaderProgram, 'lightEnabled')
  obstacleShaderProgram.lightScale = gl.getUniformLocation(obstacleShaderProgram, 'lightScale')

  mouseTargetShaderProgram = createShaderProgram(mouseTargetVert, mouseTargetFrag)
  mouseTargetShaderProgram.scale = gl.getUniformLocation(mouseTargetShaderProgram, 'scale')

  gl.enableVertexAttribArray(0)
}

function initBoidBuffers () {
  boidBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, boidBuffer)

  const boidVertices = [
    0.0, 0.04, 0.0,
    -0.1, -0.04, 0.0,
    0.1, -0.04, 0.0
  ]

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boidVertices), gl.STATIC_DRAW)
  boidBuffer.type = gl.TRIANGLES
  boidBuffer.itemSize = 3
  boidBuffer.numItems = 3
  boidBuffer.modelColor = vec4.fromValues(0.796078431372549, 0.29411764705882354, 0.08627450980392157, 1.0)
}

function initObstacleBuffers () {
  obstacleBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, obstacleBuffer)

  const obstacleVertices = [
    -0.3, 0.3, 1.0,
    0.3, 0.3, 1.0,
    0.3, -0.3, 1.0,
    0.3, -0.3, 1.0,
    -0.3, -0.3, 1.0,
    -0.3, 0.3, 1.0,

    -0.3, 0.3, -1.0,
    0.3, 0.3, -1.0,
    0.3, 0.3, 1.0,
    0.3, 0.3, 1.0,
    -0.3, 0.3, 1.0,
    -0.3, 0.3, -1.0,

    0.3, 0.3, 1.0,
    0.3, 0.3, -1.0,
    0.3, -0.3, -1.0,
    0.3, -0.3, -1.0,
    0.3, -0.3, 1.0,
    0.3, 0.3, 1.0,

    0.3, -0.3, 1.0,
    -0.3, -0.3, 1.0,
    -0.3, -0.3, -1.0,
    -0.3, -0.3, -1.0,
    0.3, -0.3, -1.0,
    0.3, -0.3, 1.0,

    -0.3, 0.3, 1.0,
    -0.3, 0.3, -1.0,
    -0.3, -0.3, -1.0,
    -0.3, -0.3, -1.0,
    -0.3, -0.3, 1.0,
    -0.3, 0.3, 1.0
  ]

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obstacleVertices), gl.STATIC_DRAW)
  obstacleBuffer.type = gl.TRIANGLES
  obstacleBuffer.itemSize = 3
  obstacleBuffer.numItems = 5 * 6
  obstacleBuffer.modelColor = vec4.fromValues(0.16470588235294117, 0.6313725490196078, 0.596078431372549, 1.0)

  obstacleNormalsBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, obstacleNormalsBuffer)

  const obstacleNormals = [
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,

    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,

    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,

    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,

    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0
  ]

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obstacleNormals), gl.STATIC_DRAW)
  obstacleNormalsBuffer.itemSize = 3
  obstacleNormalsBuffer.numItems = 5 * 6
}

function initTargetBuffer () {
  targetBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, targetBuffer)

  const targetVertices = []
  for (let i = 0.0; i < 2.0; i += 0.1) {
    targetVertices.push(Math.cos(i * Math.PI) * 0.5)
    targetVertices.push(Math.sin(i * Math.PI) * 0.5)
    targetVertices.push(0.0)
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(targetVertices), gl.STATIC_DRAW)
  targetBuffer.type = gl.LINE_LOOP
  targetBuffer.itemSize = 3
  targetBuffer.numItems = 20
  targetBuffer.modelColor = vec4.fromValues(0.7098039215686275, 0.5372549019607843, 0.0, 1.0)
}

function mouseMoveHandler (ev) {
  mouseX = ev.clientX
  mouseY = ev.clientY
}

function mouseDownHandler (ev) {
  mouseX = ev.clientX
  mouseY = ev.clientY
  mouseDown = true
}

function mouseUpHandler (ev) {
  mouseX = ev.clientX
  mouseY = ev.clientY
  mouseDown = false
  mouseUp = true
}

function calcMouseCoord () {
  const coordX = mouseX / canvas.clientWidth * 2.0 - 1.0
  const coordY = mouseY / canvas.clientHeight * -2.0 + 1.0
  let ray = vec4.fromValues(coordX, coordY, 1.0, 1.0)

  vec4.transformMat4(ray, ray, pvInverse)
  ray = vec4.fromValues(ray[0], ray[1], -1.0, 0.0)
  vec4.normalize(ray, ray)

  // plane intersection (simplified with n = (0, 0, 1))
  vec3.scale(ray, ray, VIEW_Z / ray[2])
  mouseCoord[0] = ray[0]
  mouseCoord[1] = ray[1]
}

function setupGL () {
  // (solarized colours)
  gl.clearColor(0.027450980392156862, 0.21176470588235294, 0.25882352941176473, 1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)

  mat4.perspective(perspective, 45, canvas.width / canvas.height, 0.1, 100.0)
  mat4.identity(view)
  mat4.translate(view, view, vec3.fromValues(0.0, 0.0, VIEW_Z))

  const pv = mat4.multiply(mat4.create(), perspective, view)
  mat4.invert(pvInverse, pv)
}

function drawBoids () {
  gl.useProgram(boidShaderProgram)

  gl.bindBuffer(gl.ARRAY_BUFFER, boidBuffer)
  gl.vertexAttribPointer(boidShaderProgram.vertPos, boidBuffer.itemSize, gl.FLOAT, false, 0, 0)

  gl.uniformMatrix4fv(boidShaderProgram.perspective, false, perspective)
  gl.uniformMatrix4fv(boidShaderProgram.view, false, view)
  gl.uniform4fv(boidShaderProgram.modelColor, boidBuffer.modelColor)

  const axis = vec3.create()

  for (let boid of flock.boids()) {
    mat4.identity(model)
    mat4.translate(model, model, boid.p)

    vec3.cross(axis, Y_AXIS, boid.v)
    const cosine = vec3.dot(boid.v, Y_AXIS)
    mat4.rotate(model, model, Math.acos(cosine), axis)
    gl.uniformMatrix4fv(boidShaderProgram.model, false, model)

    gl.drawArrays(boidBuffer.type, 0, boidBuffer.numItems)
  }
}

function drawObstacles () {
  gl.useProgram(obstacleShaderProgram)

  gl.bindBuffer(gl.ARRAY_BUFFER, obstacleBuffer)
  gl.vertexAttribPointer(obstacleShaderProgram.vertPos, obstacleBuffer.itemSize, gl.FLOAT, false, 0, 0)

  gl.enableVertexAttribArray(1)
  gl.bindBuffer(gl.ARRAY_BUFFER, obstacleNormalsBuffer)
  gl.vertexAttribPointer(obstacleShaderProgram.vertNormal, obstacleNormalsBuffer.itemSize, gl.FLOAT, false, 0, 0)

  gl.uniformMatrix4fv(obstacleShaderProgram.perspective, false, perspective)
  gl.uniformMatrix4fv(obstacleShaderProgram.view, false, view)
  gl.uniform3fv(obstacleShaderProgram.lightPos, mouseCoord)
  gl.uniform1i(obstacleShaderProgram.lightEnabled, (flock.mouseTarget().health !== null))
  gl.uniform1f(obstacleShaderProgram.lightScale, flock.mouseTarget().health || 0.0)
  gl.uniform4fv(obstacleShaderProgram.modelColor, obstacleBuffer.modelColor)

  for (let obstacle of flock.obstacles()) {
    mat4.identity(model)
    mat4.translate(model, model, obstacle.p)
    gl.uniformMatrix4fv(obstacleShaderProgram.model, false, model)

    gl.drawArrays(obstacleBuffer.type, 0, obstacleBuffer.numItems)
  }

  gl.disableVertexAttribArray(1)
}

function drawMouseTarget (target) {
  gl.useProgram(mouseTargetShaderProgram)

  gl.bindBuffer(gl.ARRAY_BUFFER, targetBuffer)
  gl.vertexAttribPointer(mouseTargetShaderProgram.vertPos, targetBuffer.itemSize, gl.FLOAT, false, 0, 0)

  mat4.identity(model)
  mat4.translate(model, model, target.coord)
  gl.uniformMatrix4fv(mouseTargetShaderProgram.perspective, false, perspective)
  gl.uniformMatrix4fv(mouseTargetShaderProgram.view, false, view)
  gl.uniformMatrix4fv(mouseTargetShaderProgram.model, false, model)

  gl.uniform1f(mouseTargetShaderProgram.scale, target.health)

  gl.uniform4fv(mouseTargetShaderProgram.modelColor, targetBuffer.modelColor)
  gl.drawArrays(targetBuffer.type, 0, targetBuffer.numItems)
}

function render () {
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  calcMouseCoord()
  if (mouseDown) {
    flock.activateMouseTarget()
  } else if (mouseUp) {
    flock.stopMouseTarget()
    mouseUp = false
  }

  drawBoids()
  drawObstacles()

  const target = flock.mouseTarget()
  if (target.health) {
    drawMouseTarget(target)
  }

  flock.update()
  window.requestAnimationFrame(render)
}

(() => {
  if (!window.location.search) {
    window.location.search = '?boids=100&obstacles=3'
  }

  const params = URI(window.location.search).search(true)
  const numBoids = params.boids || 100
  const numObstacles = params.obstacles || 3

  canvas = document.getElementById('glcanvas')
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

  if (!gl) {
    throw new Error('Failed to initialize WebGL context')
  }

  const resize = () => {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }
  window.addEventListener('resize', resize)
  resize()

  initShaderPrograms()
  initBoidBuffers()
  initObstacleBuffers()
  initTargetBuffer()

  flock = Flock(canvas.width / canvas.height, numBoids, numObstacles)

  flock.linkMouseTarget(mouseCoord)
  canvas.onmousemove = mouseMoveHandler
  canvas.onmousedown = mouseDownHandler
  canvas.onmouseup = mouseUpHandler

  setupGL()
  render()
})()
