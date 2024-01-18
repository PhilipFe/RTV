//#region Camera
//----------------------------------------------------------------------------------------------------------------------

class Camera {
    // settings

    /** 
     * mouse sensitivity
     * @type {number} 
     */
    #sens = 0.05;

    /** 
     * movement speed
     * @type {number} 
     */
    #speed = 2.0;
    
    /** 
     * movement speed modifier (sprint speed)
     * @type {number} 
     */
    #speed_mod = 3.0;

    /** 
     * field of view
     * @type {number} 
     */
    #fov = 74.34;

    /** 
     * near plane
     * @type {number} 
     */
    #znear = 0.1;

    /** 
     * far plane
     * @type {number} 
     */
    #zfar = 25;

    /** 
     * maximal distance to the origin (bounding sphere to restrict movement)
     * @type {number} 
     */
    #max_distance = 3;

    // world space coordinate system

    /** 
     * world right vector
     * @type {number} 
     */
    #world_right     = vec3.create(1, 0, 0);

    /** 
     * world forward vector
     * @type {number} 
     */
    #world_forward   = vec3.create(0, 1, 0);

    /** 
     * world up vector
     * @type {number} 
     */
    #world_up        = vec3.create(0, 0, 1);
    
    // view space coordinate system

    /** 
     * camera coordinate system right vector
     * @type {number} 
     */
    #right;

    /** 
     * camera coordinate system up vector
     * @type {number} 
     */
    #up;
    
    /** 
     * camera coordinate system forward vector
     * @type {number} 
     */
    #forward;
    
    // world space coordinates

    /** 
     * camera position
     * @type {number} 
     */
    #pos;

    /** 
     * camera rotation
     * @type {number} 
     */
    #rot;

    /** 
     * camera scale
     * @type {number} 
     */
    scale;

    // matrices

    /** 
     * perspective matrix
     * @type {number} 
     */
    #p;

    /** 
     * view matrix
     * @type {number} 
     */
    #v;

    /** 
     * cached view-projection matrix
     * @type {number} 
     */
    #pv;

    //------------------------------------------------------------------------------------------------------------------

    /**
     * constructor
     */
    constructor(width, height) {
        this.#right = vec3.create();
        this.#up = vec3.create();
        this.#forward = vec3.create();
        
        this.#pos = vec3.create(0, -3, 0);
        this.#rot = vec3.create(-90, 0, 180);
        this.scale = 1.0;
        
        this.#p = mat4.perspective(degToRad(this.#fov), width/height, this.#znear, this.#zfar);
        this.#v = mat4.create();
        this.#pv = mat4.create();

        this.#reconstruct();
    }

    /**
     * update camera position and rotation according to the input and delta time 
     */
    update(dt, input) {
        // position
        let movespeed = this.#speed * (1.0/this.scale) * dt;
        if (input['ShiftLeft']) {
            movespeed *= this.#speed_mod;
        }
        if (input['KeyW']) {
            vec3.addScaled(this.#pos, this.#forward, movespeed, this.#pos);
        }
        if (input['KeyA']) {
            vec3.addScaled(this.#pos, this.#right, -movespeed, this.#pos);
        }
        if (input['KeyS']) {
            vec3.addScaled(this.#pos, this.#forward, -movespeed, this.#pos);
        }
        if (input['KeyD']) {
            vec3.addScaled(this.#pos, this.#right, movespeed, this.#pos);
        }
        if (input['Space']) {
            vec3.addScaled(this.#pos, this.#up, movespeed, this.#pos);
        }
        if (input['KeyC']) {
            vec3.addScaled(this.#pos, this.#up, -movespeed, this.#pos);
        }
        
        if(vec3.length(this.#pos) > this.#max_distance) {
            vec3.mulScalar(vec3.normalize(this.#pos), this.#max_distance, this.#pos);
        }

        // rotation
        this.#rot[2] += input['x'] * this.#sens;
        this.#rot[0] -= input['y'] * this.#sens;
        this.#rot[0] = Math.min(Math.max(this.#rot[0], -179.0), 0.0);

        this.#reconstruct();
    }

    /**
     * Reconstructs the perspective projection according to a changed viewport 
     */
    resized(width, height) {
        this.#p = mat4.perspective(degToRad(this.#fov), width/height, this.#znear, this.#zfar);
        this.#reconstruct();
    }

    /**
     * Returns the view-projection matrix
     */
    pv() {
        return this.#pv;
    }

    /**
     * Position getter
     */
    position() {
        return this.#pos;
    }

    /**
     * Position setter
     */
    setPosition(x, y, z) {
        this.#pos[0] = x;
        this.#pos[1] = y;
        this.#pos[2] = z;
        this.#reconstruct();
    }

    /**
     * Rotation getter
     */
    rotation() {
        return this.#rot;
    }

    /**
     * Rotation setter
     */
    setRotation(pitch, yaw) {
        this.#rot[0] = pitch;
        this.#rot[2] = yaw;
        this.#reconstruct();
    }

    /**
     * returns the right axis of the coordinate system
     */
    right() {
        return this.#right;
    }

    /**
     * returns the up axis of the coordinate system
     */
    up() {
        return this.#up;
    }

    /**
     * returns the forward axis of the coordinate system
     */
    forward() {
        return this.#forward;
    }

    /**
     * Calculates the view matrix and the camera coordinate system using position and rotation of the camera
     */
    #reconstruct() {
        // view matrix
        mat4.identity(this.#v);
        mat4.rotate(this.#v, this.#world_right, degToRad(-this.#rot[0]), this.#v);
        mat4.rotate(this.#v, this.#world_up, degToRad(-this.#rot[2]), this.#v);
        mat4.translate(this.#v, vec3.mulScalar(this.#pos, -1), this.#v);
        
        // camera coordinate system from view matrix
        this.#right[0] = this.#v[4 * 0 + 0];
        this.#right[1] = this.#v[4 * 1 + 0];
        this.#right[2] = this.#v[4 * 2 + 0];
        this.#up[0] = this.#v[4 * 0 + 1];
        this.#up[1] = this.#v[4 * 1 + 1];
        this.#up[2] = this.#v[4 * 2 + 1];
        this.#forward[0] = -this.#v[4 * 0 + 2];
        this.#forward[1] = -this.#v[4 * 1 + 2];
        this.#forward[2] = -this.#v[4 * 2 + 2];

        // final view-projection matrix
        mat4.mul(this.#p, this.#v, this.#pv);
    }
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion