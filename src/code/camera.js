//#region Camera
//----------------------------------------------------------------------------------------------------------------------

class Camera {
    // settings
    #sens = 0.05;
    #speed = 2.0;
    #speed_mod = 3.0;
    #fov = 74.34
    #znear = 0.1
    #zfar = 25

    // world space coordinate system
    #world_right     = vec3.create(1, 0, 0);
    #world_forward   = vec3.create(0, 1, 0);
    #world_up        = vec3.create(0, 0, 1);
    
    // view space coordinate system
    #right;
    #up;
    #forward;
    
    // world space coordinates
    #pos;
    #rot;

    // matrices
    #p;
    #v;
    #pv;

    //------------------------------------------------------------------------------------------------------------------

    constructor(width, height) {
        this.#right = vec3.create();
        this.#up = vec3.create();
        this.#forward = vec3.create();
        
        this.#pos = vec3.create(0, -1, 0);
        this.#rot = vec3.create(-90, 0, 180);
        
        this.#p = mat4.perspective(degToRad(this.#fov), width/height, this.#znear, this.#zfar);
        this.#v = mat4.create();
        this.#pv = mat4.create();

        this.#reconstruct();
    }

    update(dt, input) {
        // position
        let movespeed = this.#speed * dt;
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

        // rotation
        this.#rot[2] += input['x'] * this.#sens;
        this.#rot[0] -= input['y'] * this.#sens;
        this.#rot[0] = Math.min(Math.max(this.#rot[0], -179.0), 0.0);

        this.#reconstruct();
    }

    resized(width, height) {
        this.#p = mat4.perspective(degToRad(this.#fov), width/height, this.#znear, this.#zfar);
        this.#reconstruct();
    }

    pv() {
        return this.#pv;
    }

    position() {
        return this.#pos;
    }

    right() {
        return this.#right;
    }

    up() {
        return this.#up;
    }

    forward() {
        return this.#forward;
    }

    /**
     * Calculates the view matrix and the camera coordinate system using position and rotation of the camera
     */
    #reconstruct() {
        // view matrix (fuck lookat: https://stannum.io/blog/0UaG8R)
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