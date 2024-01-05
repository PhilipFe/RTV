import {vec3, mat4} from 'https://wgpu-matrix.org/dist/2.x/wgpu-matrix.module.js';

//#region Helper funcitons
//----------------------------------------------------------------------------------------------------------------------
function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}

function mod(x, div) {
    return x - Math.floor(Math.abs(x) / div) * div * Math.sign(x);
}


function rotate(vec, axis, angle) {
    return vec3.transformMat4Upper3x3(vec, mat4.rotation(axis, angle));
  }
  
  function lerp(a, b, s) {
    return vec3.addScaled(a, vec3.sub(b, a), s);
  }
//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region Arcball Camera
//----------------------------------------------------------------------------------------------------------------------
class ArcballCamera {
    constructor(options) {
      this.matrix_ = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      this.view_ = mat4.create();
      this.right_ = new Float32Array(this.matrix_.buffer, 4 * 0, 4);
      this.up_ = new Float32Array(this.matrix_.buffer, 4 * 4, 4);
      this.back_ = new Float32Array(this.matrix_.buffer, 4 * 8, 4);
      this.position_ = new Float32Array(this.matrix_.buffer, 4 * 12, 4);
  
      this.distance = 0;
      this.angularVelocity = 0;
      this.axis_ = vec3.create();
      this.rotationSpeed = 1;
      this.zoomSpeed = 0.1;
      this.frictionCoefficient = 0.999;
  
      if (options && options.position) {
        this.position = options.position;
        this.distance = vec3.len(this.position);
        this.back = vec3.normalize(this.position);
        this.recalcuateRight();
        this.recalcuateUp();
      }
    }
  
    get matrix() {
      return this.matrix_;
    }
  
    set matrix(mat) {
      mat4.copy(mat, this.matrix_);
      this.distance = vec3.len(this.position);
    }
  
    get view() {
      return this.view_;
    }
  
    set view(mat) {
      mat4.copy(mat, this.view_);
    }
  
    get right() {
      return this.right_;
    }
  
    set right(vec) {
      vec3.copy(vec, this.right_);
    }
  
    get up() {
      return this.up_;
    }
  
    set up(vec) {
      vec3.copy(vec, this.up_);
    }
  
    get back() {
      return this.back_;
    }
  
    set back(vec) {
      vec3.copy(vec, this.back_);
    }
  
    get position() {
      return this.position_;
    }
  
    set position(vec) {
      vec3.copy(vec, this.position_);
    }
  
    get axis() {
      return this.axis_;
    }
  
    set axis(vec) {
      vec3.copy(vec, this.axis_);
    }
  
    update(deltaTime, input) {
        const epsilon = 0.0000001;

        if (input.analog.touching) {
          // Currently being dragged.
          this.angularVelocity = 0;
        } else {
          // Dampen any existing angular velocity
          this.angularVelocity *= Math.pow(1 - this.frictionCoefficient, deltaTime);
        }
    
        // Calculate the movement vector
        const movement = vec3.create();
        vec3.addScaled(movement, this.right, input.analog.x, movement);
        vec3.addScaled(movement, this.up, -input.analog.y, movement);
    
        // Cross the movement vector with the view direction to calculate the rotation axis x magnitude
        const crossProduct = vec3.cross(movement, this.back);
    
        // Calculate the magnitude of the drag
        const magnitude = vec3.len(crossProduct);
    
        if (magnitude > epsilon) {
          // Normalize the crossProduct to get the rotation axis
          this.axis = vec3.scale(crossProduct, 1 / magnitude);
    
          // Remember the current angular velocity. This is used when the touch is released for a fling.
          this.angularVelocity = magnitude * this.rotationSpeed;
        }
    
        // The rotation around this.axis to apply to the camera matrix this update
        const rotationAngle = this.angularVelocity * deltaTime;
        if (rotationAngle > epsilon) {
          // Rotate the matrix around axis
          // Note: The rotation is not done as a matrix-matrix multiply as the repeated multiplications
          // will quickly introduce substantial error into the matrix.
          this.back = vec3.normalize(rotate(this.back, this.axis, rotationAngle));
          this.recalcuateRight();
          this.recalcuateUp();
        }
    
        // recalculate `this.position` from `this.back` considering zoom
        if (input.analog.zoom !== 0) {
          this.distance *= 1 + input.analog.zoom * this.zoomSpeed;
        }
        this.position = vec3.scale(this.back, this.distance);
    
        // Invert the camera matrix to build the view matrix
        this.view = mat4.invert(this.matrix);
        return this.view;
    }
  
    recalcuateRight() {
      this.right = vec3.normalize(vec3.cross(this.up, this.back));
    }
  
    recalcuateUp() {
        this.up = vec3.normalize(vec3.cross(this.back, this.right));
    }
}

export default ArcballCamera;
//----------------------------------------------------------------------------------------------------------------------
//#endregion