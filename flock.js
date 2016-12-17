'use strict'
const vec3 = require('gl-vec3')

module.exports = (aspectRatio, numBoids, numObstacles) => {
  const ZONE_INNER = 1.0
  const ZONE_OUTER = 2.0
  const MAX_NEIGHBOURS_CHECK = 20
  const VISION_HALF_ANGLE = 160.0 * Math.PI / 180.0
  const VISION_HALF_ANGLE_RESTRICTED = 15.0 * Math.PI / 180.0

  const BOUNDS_X_MIN = -10.0
  const BOUNDS_X_MAX = 10.0
  const BOUNDS_Y_MIN = -8.0 / aspectRatio
  const BOUNDS_Y_MAX = 8.0 / aspectRatio
  const BOUNDS_Z_MIN = -1.0
  const BOUNDS_Z_MAX = 1.0

  const SPEED = 0.1

  const MOUSE_TARGET_LIFE_MS = 3000

  const WEIGHT_COHESION = 0.1
  const WEIGHT_ALIGNMENT = 0.1
  const WEIGHT_SEPARATION = 0.2
  const WEIGHT_BOUNDARY = 0.2
  const WEIGHT_MOUSE = 0.2
  const WEIGHT_OBSTACLE = 0.2

  let mouseTarget = {}
  let mouseDecay = false

  const boids = []
  const obstacles = []

  const rand = (min, max) => min + Math.random() * (max - min)

  for (let i = 0; i < numBoids; i++) {
    boids.push({
      i: i,
      p: vec3.fromValues(
        rand(BOUNDS_X_MIN, BOUNDS_X_MAX),
        rand(BOUNDS_Y_MIN, BOUNDS_Y_MAX),
        rand(BOUNDS_Z_MIN, BOUNDS_Z_MAX)
      ),
      v: vec3.normalize(
        vec3.create(),
        vec3.fromValues(
          rand(-1.0, 1.0),
          rand(-1.0, 1.0),
          rand(-1.0, 1.0)
        )
      ),
      visionA: VISION_HALF_ANGLE
    })
  }

  for (let i = 0; i < numObstacles; i++) {
    obstacles.push({
      i: i,
      p: vec3.fromValues(
        rand(BOUNDS_X_MIN + 1.0, BOUNDS_X_MAX - 1.0),
        rand(BOUNDS_Y_MIN + 1.0, BOUNDS_Y_MAX - 1.0),
        0.0
      ),
      r: 1.5
    })
  }

  // the core boids algorithm
  const calcNeighbourTargets = (boid) => {
    const target = {
      cohesion: vec3.create(),
      alignment: vec3.create(),
      separation: vec3.create()
    }

    let totalClose = 0
    let totalP = vec3.create()
    let totalV = vec3.create()

    let totalTooClose = 0
    let totalTooCloseP = vec3.create()
    const dir = vec3.create()

    // inline the vec3 math here for performance
    for (let i = 0; i < boids.length; i++) {
      if (boid.i === i) {
        continue
      }

      dir[0] = boids[i].p[0] - boid.p[0]
      dir[1] = boids[i].p[1] - boid.p[1]
      dir[2] = boids[i].p[2] - boid.p[2]
      const dist = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2])

      if (dist <= ZONE_OUTER) {
        const invDist = 1.0 / dist
        dir[0] *= invDist
        dir[1] *= invDist
        dir[2] *= invDist

        const cosine = boid.v[0] * dir[0] + boid.v[1] * dir[1] + boid.v[2] * dir[2]
        const angle = Math.acos(cosine)

        if (angle <= boid.visionA) {
          if (dist > ZONE_INNER) {
            totalClose++
            totalP[0] += boids[i].p[0]
            totalP[1] += boids[i].p[1]
            totalP[2] += boids[i].p[2]
            totalV[0] += boids[i].v[0]
            totalV[1] += boids[i].v[1]
            totalV[2] += boids[i].v[2]
          } else {
            totalTooClose++
            totalTooCloseP[0] += boids[i].p[0]
            totalTooCloseP[1] += boids[i].p[1]
            totalTooCloseP[2] += boids[i].p[2]
          }
        }

        if (totalClose + totalTooClose > MAX_NEIGHBOURS_CHECK) {
          break
        }
      }
    }

    if (totalClose > 0) {
      const avgP = vec3.scale(vec3.create(), totalP, 1.0 / totalClose)
      const avgV = vec3.scale(vec3.create(), totalV, 1.0 / totalClose)
      vec3.subtract(target.cohesion, avgP, boid.p)
      vec3.normalize(target.cohesion, target.cohesion)
      target.alignment = avgV
      vec3.normalize(target.alignment, target.alignment)
    }

    if (totalTooClose > 0) {
      const avgTooCloseP = vec3.scale(vec3.create(), totalTooCloseP, 1.0 / totalTooClose)
      vec3.subtract(target.separation, avgTooCloseP, boid.p)
      vec3.scale(target.separation, target.separation, -1.0)
      vec3.normalize(target.separation, target.separation)
    }

    return target
  }

  const calcBoundaryTarget = (boid) => {
    let target = vec3.create()

    if (boid.p[0] <= BOUNDS_X_MIN) {
      target = vec3.fromValues(1.0, 0.0, 0.0)
    } else if (boid.p[0] >= BOUNDS_X_MAX) {
      target = vec3.fromValues(-1.0, 0.0, 0.0)
    } else if (boid.p[1] <= BOUNDS_Y_MIN) {
      target = vec3.fromValues(0.0, 1.0, 0.0)
    } else if (boid.p[1] >= BOUNDS_Y_MAX) {
      target = vec3.fromValues(0.0, -1.0, 0.0)
    } else if (boid.p[2] <= BOUNDS_Z_MIN) {
      target = vec3.fromValues(0.0, 0.0, 1.0)
    } else if (boid.p[2] >= BOUNDS_Z_MAX) {
      target = vec3.fromValues(0.0, 0.0, -1.0)
    }

    return target
  }

  const calcMouseTarget = (boid) => {
    const target = vec3.subtract(vec3.create(), mouseTarget.coord, boid.p)
    vec3.normalize(target, target)
    return target
  }

  const decayTarget = () => {
    const diff = new Date() - mouseTarget.decayStart
    if (diff > MOUSE_TARGET_LIFE_MS) {
      mouseTarget.health = null
      mouseDecay = false
    } else {
      mouseTarget.health = 1.0 - (diff / MOUSE_TARGET_LIFE_MS)
    }
  }

  // simple cubic obstacles
  // circles are used as perimeters for collision detection
  // (we ignore Z and compute in 2D; looks okay here since we haven't got a big Z range)
  //
  // the advantage of circles are that we can use their tangents
  // to determine a deflection target for the boid
  //
  // we check if the boid is in the main obstacle perimeter, and then use the circle
  // formed by r = len(boid.p - obstacle.p) to determine deflection (orthogonal vectors)
  const calcObstaclesTarget = (boid) => {
    const result = {
      inPerimeter: false,
      target: vec3.create()
    }

    for (let i = 0; i < numObstacles; i++) {
      const b2d = vec3.fromValues(boid.p[0], boid.p[1], 0.0)
      const bc = vec3.subtract(vec3.create(), b2d, obstacles[i].p)
      if (vec3.length(bc) < obstacles[i].r) {
        result.inPerimeter = true
        vec3.normalize(bc, bc)
        const orthR = vec3.fromValues(bc[1], -bc[0], 0.0)

        if (vec3.dot(orthR, boid.v) > 0) {
          result.target = orthR
        } else {
          result.target = vec3.fromValues(-bc[1], bc[0], 0.0)
        }

        // restrict the boid's vision
        boid.visionA = VISION_HALF_ANGLE_RESTRICTED
      }
    }

    return result
  }

  return {
    boids: () => boids,
    obstacles: () => obstacles,

    linkMouseTarget: (coord) => {
      mouseTarget.coord = coord
      mouseTarget.health = null
      mouseTarget.decayStart = null
    },

    activateMouseTarget: () => {
      mouseTarget.health = 1.0
    },

    stopMouseTarget: () => {
      mouseDecay = true
      mouseTarget.decayStart = new Date()
    },

    mouseTarget: () => mouseTarget,

    update: () => {
      for (let boid of boids) {
        boid.visionA = VISION_HALF_ANGLE
        const target = vec3.create()
        let targetPriority = 1.0

        const obstacle = calcObstaclesTarget(boid)
        if (obstacle.inPerimeter) {
          vec3.scaleAndAdd(target, target, obstacle.target, WEIGHT_OBSTACLE)
          targetPriority = 0.1
        } else {
          const neighbourTargets = calcNeighbourTargets(boid)
          vec3.scaleAndAdd(target, target, neighbourTargets.cohesion, WEIGHT_COHESION)
          vec3.scaleAndAdd(target, target, neighbourTargets.alignment, WEIGHT_ALIGNMENT)
          vec3.scaleAndAdd(target, target, neighbourTargets.separation, WEIGHT_SEPARATION)

          vec3.scaleAndAdd(target, target, calcBoundaryTarget(boid), WEIGHT_BOUNDARY)
        }

        if (mouseTarget.health) {
          vec3.scaleAndAdd(target, target, calcMouseTarget(boid), targetPriority * WEIGHT_MOUSE * mouseTarget.health)
        }

        vec3.add(boid.v, boid.v, target)
        vec3.normalize(boid.v, boid.v)
        const step = vec3.scale(vec3.create(), boid.v, SPEED)
        vec3.add(boid.p, boid.p, step)
      }

      if (mouseDecay) {
        decayTarget()
      }
    }
  }
}
