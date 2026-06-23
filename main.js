const vertexShaderSrc = `#version 300 es
in vec2 aVertexPosition;
out vec2 vUv;

void main() {
  vUv = aVertexPosition;
  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}
`;

const PER_SEG = 20;
const BALLS = 7 * 4 * PER_SEG;

function fragmentTemplate() {
  return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float time;

uniform vec4 balls[${BALLS}];

float circle(vec2 uv, vec2 pos, float r) {
    // wobble
    r += sin(uv.x * 30.0 + uv.y * 30.0 + time) * 0.0005;
    // return max(0.0, 1.0 - dot(uv, pos) / (r * r));
    return r/distance(uv, pos);
}

void main() {
  // vec3 color = step(d, 0.5) * vec3(1.0, 1.0, 1.0);
  // vec3 color = vec3(0.0);

  vec3 color = vec3(0.0);
  float influence = 0.0;
  for (int i = 0; i < ${BALLS}; ++i) {
    vec4 b = balls[i];
    influence = max(influence, circle(vUv, b.xy, 0.003));
  }
  color += step(0.12, influence) * vec3(1.0);
  // color = vec3(influence);
  fragColor = vec4(1.0 - color, 1.0);
}
  `;
}

const s = [
  0b00111111, // 0
  0b00000110, // 1
  0b01101101, // 2
  0b01001111, // 3
  0b01010110, // 4
  0b01011011, // 5
  0b01111011, // 6
  0b00001110, // 7
  0b01111111, // 8
  0b01011111, // 9
];

const gap = 0.2;
const lines = [
  [
    [-0.5 + gap, -1],
    [0.5 - gap, -1],
  ], // A
  [
    [0.5, -1.0 + gap],
    [0.5, 0.0 - gap],
  ], // B
  [
    [0.5, 0.0 + gap],
    [0.5, 1 - gap],
  ], // C
  [
    [-0.5 + gap, 1],
    [0.5 - gap, 1],
  ], // D
  [
    [-0.5, 0.0 + gap],
    [-0.5, 1 - gap],
  ], // E
  [
    [-0.5, -1 + gap],
    [-0.5, 0 - gap],
  ], // F
  [
    [-0.5 + gap, 0],
    [0.5 - gap, 0],
  ], // G
];

function timeToSegs(time) {
  const hours = time.getHours() + cheese;
  const h1 = hours % 10;
  const h2 = Math.floor(hours / 10);
  const minutes = time.getMinutes();
  const m1 = minutes % 10;
  const m2 = Math.floor(minutes / 10);
  return [s[h2], s[h1], s[m2], s[m1]];
}

function compileShader(gl, code, type) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, code);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(
      `Error compiling ${
        type === gl.VERTEX_SHADER ? "vertex" : "fragment"
      } shader:`,
    );
    console.log(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function buildShaderProgram(gl, shaderInfo) {
  const program = gl.createProgram();

  shaderInfo.forEach((desc) => {
    const shader = compileShader(gl, desc.code, desc.type);

    if (shader) {
      gl.attachShader(program, shader);
    }
  });

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("Error linking shader program:");
    console.log(gl.getProgramInfoLog(program));
  }

  return program;
}

const lerp = (start, end, t) => start + (end - start) * t;

let cheese = 0;
function addOne() {
  cheese += 1;
}

function lineLerp(line, t) {
  const [start, end] = line;
  return [lerp(start[0], end[0], t), lerp(start[1], end[1], t)];
}

const freeAgents = new Set();

// VALUE: remapped guy for idx
const idx2slot = [];
const slot2idx = [];
function setupShader(canvas) {
  const gl = canvas.getContext("webgl2");

  const shaderSet = [
    {
      type: gl.VERTEX_SHADER,
      code: vertexShaderSrc,
    },
    {
      type: gl.FRAGMENT_SHADER,
      code: fragmentTemplate(),
    },
  ];

  const shaderProgram = buildShaderProgram(gl, shaderSet);
  const timeLoc = gl.getUniformLocation(shaderProgram, "time");
  const ballsLoc = gl.getUniformLocation(shaderProgram, "balls");

  const balls = Array(BALLS * 4).fill(0);
  const ballData = new Float32Array(balls);

  const now = timeToSegs(new Date());
  for (let i = 0; i < BALLS * 4; i += 4) {
    const idx = i / 4;
    const l = Math.floor(idx / PER_SEG) % 7;
    const n = Math.floor(idx / PER_SEG / 7);
    const o = idx % PER_SEG;
    const line = lines[l];
    const [x, y] = lineLerp(line, (o + 1) / (PER_SEG + 1));
    /*
    const on = Boolean(now[n] & (1 << l));
    if (on) {
      idx2slot.push(idx);
      slot2idx.push(idx);
    } else {
      idx2slot.push(null);
      slot2idx.push(null);
      freeAgents.add(idx);
    }
      */
    ballData[i + 0] = x * 0.2 + (n - 1.5) * 0.4 + Math.sign(n - 1.5) * 0.05;
    ballData[i + 1] = y * 0.2;
    ballData[i + 2] = 0.0;
    ballData[i + 3] = 0.0;
  }

  // Vertex information
  const vertexArray = new Float32Array([
    -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0,
  ]);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
  const vertexNumComponents = 2;
  const vertexCount = vertexArray.length / vertexNumComponents;

  // Animation timing
  let previousTime = 0.0;
  let time = 0.0;

  const animateScene = (delta) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(shaderProgram);
    gl.uniform1f(timeLoc, time);

    const now = timeToSegs(new Date());

    const PX = 0;
    const PY = 1;
    const VX = 2;
    const VY = 3;

    const floor = -0.99;

    // update
    for (let i = 0; i < BALLS; i++) {
      // gravity
      ballData[i * 4 + VY] -= delta * 0.1;

      // apply magnets
      for (let n = 0; n < now.length; ++n) {
        // which number
        for (let s = 0; s < 7; ++s) {
          const on = Boolean(now[n] & (1 << s));
          if (!on) continue;
          // which segment
          for (let j = 0; j < PER_SEG; ++j) {
            // point along line
            const line = lines[s];
            let [x, y] = lineLerp(line, (j + 1) / (PER_SEG + 1));
            // transform to number local
            x = x * 0.2 + (n - 1.5) * 0.4 + Math.sign(n - 1.5) * 0.05;
            y = y * 0.2;
            const px = ballData[i * 4 + PX];
            const py = ballData[i * 4 + PY];
            let fx = px - x;
            let fy = py - y;
            const d2 = fx * fx + fy * fy;
            const d = Math.sqrt(d2);
            if (d > 0.05) continue;
            fx /= d;
            fy /= d;
            const f = delta * 0.2;
            ballData[i * 4 + VX] -= (f * fx) / Math.max(d2, 2.0);
            ballData[i * 4 + VY] -= (f * fy) / Math.max(d2, 2.0);
          }
        }
      }
      // decelerate X
      ballData[i * 4 + VX] *= 0.99;

      // apply velocity
      ballData[i * 4 + PX] += delta * ballData[i * 4 + VX];
      ballData[i * 4 + PY] += delta * ballData[i * 4 + VY];

      // interact with floor
      if (ballData[i * 4 + PY] < floor) {
        ballData[i * 4 + PY] = floor;
        ballData[i * 4 + VY] = 0;
      }
    }

    /*
    // free up agents
    for (let i = 0; i < BALLS; i++) {
      const l = Math.floor(i / PER_SEG) % 7;
      const n = Math.floor(i / PER_SEG / 7);
      const o = i % PER_SEG;
      const on = Boolean(now[n] & (1 << l));
      if (!on && slot2idx[i] !== null) {
        const agent = slot2idx[i];
        freeAgents.add(agent);
        slot2idx[i] = null;
        idx2slot[agent] = null;
      }
    }
    // find new assignments, if needed
    for (let i = 0; i < BALLS; i++) {
      const l = Math.floor(i / PER_SEG) % 7;
      const n = Math.floor(i / PER_SEG / 7);
      const o = i % PER_SEG;
      const on = Boolean(now[n] & (1 << l));
      if (on && slot2idx[i] === null) {
        const line = lines[l];
        const [x, y] = lineLerp(line, (o + 1) / (PER_SEG + 1));
        const tx = x * 0.2 + (n - 1.5) * 0.4 + Math.sign(n - 1.5) * 0.05;
        const ty = y * 0.2;
        let minDist = 1000.0;
        let best = null;
        freeAgents.forEach((agent) => {
          const x = ballData[agent * 4];
          const y = ballData[agent * 4 + 1];
          const d2 = (x - tx) * (x - tx) + (y - ty) * (y - ty);
          if (d2 < minDist) {
            minDist = d2;
            best = agent;
          }
        });
        freeAgents.delete(best);
        slot2idx[i] = best;
        idx2slot[best] = i;
      }
    }
    // move everybody around
    for (let i = 0; i < BALLS * 4; i += 4) {
      const idx = i / 4;
      const assigned = idx2slot[idx];

      if (assigned === null) {
        if (ballData[i + 1] < -0.7) {
          ballData[i + 0] += (Math.sin(i + Math.sin(time)) * delta) / 40000.0;
        }
        ballData[i + 0] = Math.min(Math.max(ballData[i + 0], -0.98), 0.98);
        ballData[i + 1] -= delta / 20000.0;
        ballData[i + 1] = Math.max(ballData[i + 1], -0.98);
        continue;
      }
      const l = Math.floor(assigned / PER_SEG) % 7;
      const n = Math.floor(assigned / PER_SEG / 7);
      const o = assigned % PER_SEG;
      const line = lines[l];
      const [x, y] = lineLerp(line, (o + 1) / (PER_SEG + 1));
      const tx = x * 0.2 + (n - 1.5) * 0.4 + Math.sign(n - 1.5) * 0.05;
      const ty = y * 0.2;
      const factor = 1 - Math.pow(1 - 0.1, delta / 200.0);
      ballData[i + 0] += (tx - ballData[i + 0]) * factor;
      ballData[i + 1] += (ty - ballData[i + 1]) * factor;
      ballData[i + 2] = 0.0;
      ballData[i + 3] = 0.0;
    }
      */

    gl.uniform4fv(ballsLoc, ballData);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");

    gl.enableVertexAttribArray(aVertexPosition);
    gl.vertexAttribPointer(
      aVertexPosition,
      vertexNumComponents,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    requestAnimationFrame((currentTime) => {
      const delta = currentTime - previousTime;
      time += delta / 1000.0;
      animateScene(delta / 1000);
      previousTime = currentTime;
    });
  };
  animateScene(0.0);
}
