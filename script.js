// const { createCanvas } = require('canvas');
const QUALITY = 400;

var render1, testmap1, render2, testmap2;

if (typeof window !== "undefined") {
    render1 = document.querySelectorAll("canvas")[0];
    testmap1 = document.querySelectorAll("canvas")[1];
    render2 = document.querySelectorAll("canvas")[2];
    testmap2 = document.querySelectorAll("canvas")[3];

    render1.width = QUALITY;
    render1.height = QUALITY;
    testmap1.width = QUALITY;
    testmap1.height = QUALITY;
}

let ctx1 = render1?.getContext("2d");
let ctx2 = testmap1?.getContext("2d");
let ctx3 = render2?.getContext("2d");
let ctx4 = testmap2?.getContext("2d");

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    normalize() { 
        let len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }

    dot (v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
}

// --- RENDER VARIABLES --- //

const cameraPos = new Vector3(0, 0, -3);
const maxDist = 500;
const eps = 0.001;

// ------------------------ //


// Scene function 

function sphereSDF(v, p, r) {
    return Math.sqrt((v.x - p.x) * (v.x - p.x) + (v.y - p.y) * (v.y - p.y) + (v.z - p.z) * (v.z - p.z)) - r;
}

let spheres = [];
const sphereR = 0.1;
const NUM_SPHERES = 50;

function generateScene(){
    spheres = [];
    for(var i = 0; i < NUM_SPHERES; i ++) {
        spheres.push({
            r: Math.random() * 0.1 + 0.05,
            mid: new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        });
    }
}

generateScene();


function sdf(v) {
    var d = sphereSDF(v, spheres[0].mid, spheres[0].r);

    for(var i = 1 ; i < spheres.length; i ++ ){
        d = Math.min(d, sphereSDF(v, spheres[i].mid, spheres[i].r));
    }

    return d;
}

function getNormal(v) {
    let x = sdf(new Vector3(v.x + eps, v.y, v.z)) - sdf(new Vector3(v.x - eps, v.y, v.z));
    let y = sdf(new Vector3(v.x, v.y + eps, v.z)) - sdf(new Vector3(v.x, v.y - eps, v.z));
    let z = sdf(new Vector3(v.x, v.y, v.z + eps)) - sdf(new Vector3(v.x, v.y, v.z - eps));
    return new Vector3(x, y, z).normalize();
}


// Rendering methods

// raymarching - traditional approach 
function raymarch(ro, rd) {
    let t = 0;
    let p = new Vector3(ro.x, ro.y, ro.z);

    let steps = 0;
    while (t < maxDist) {
        let d = sdf(p); steps ++;

        if (d < eps) break;

        t += d;
        p.x += rd.x * d;
        p.y += rd.y * d;
        p.z += rd.z * d;
    }

    return {
        steps: steps,
        dist: t,
        hit: t < maxDist,
        p: p
    }
}

// binary search with SDF aid
function binarycast(ro, rd) {
    var extents = [0, maxDist];
    var next = [];

    var steps = 0;
    let p = new Vector3(ro.x, ro.y, ro.z);

    while (true) {
        var mid = (extents[0] + extents[1]) * 0.5;
        var size = (extents[1] - extents[0]) * 0.5;

        p.x = ro.x + rd.x * mid;
        p.y = ro.y + rd.y * mid;
        p.z = ro.z + rd.z * mid;

        var d = sdf(p); steps ++;

        if (d <= size) {
            if (size < eps) {
                return {
                    steps: steps,
                    dist: mid,
                    hit: true,
                    p: p
                }
            } else {
                var a = [extents[0], mid - (d - eps)];
                var b = [mid + (d - eps), extents[1]];

                extents = a;
                next.push(b);
            }
        } else {
            if (next.length === 0) break;
            extents = next.pop();
        }
    }

    return {
        steps: steps,
        dist: mid,
        hit: false,
        p: new Vector3(0, 0, 0)
    }
}

// sample the scene at a given uv coordinate
function sample(u, v, caster){
    let x = u * 2 - 1;
    let y = v * 2 - 1;

    let rd = new Vector3(x, y, 2).normalize();
    return caster(cameraPos, rd);
}


// data gathering
var data = [];
var generateData = function(num, testID){
    for(var i = 0; i < num; i ++){
        var x = Math.random();
        var y = Math.random();

        var hitA = sample(x, y, raymarch);
        var hitB = sample(x, y, binarycast);

        data.push({
            x: x, 
            y: y,
            hitA: hitA.hit,
            hitB: hitB.hit,
            stepsA: hitA.steps,
            stepsB: hitB.steps,
            testID: testID
        });
    }
}

// calculate lighting for model comparison images
const light = new Vector3(1, 1, -2).normalize();
function shade (samplePoint) {
    var normal = getNormal(samplePoint.p);
    var directLight = normal.dot(light);
    directLight = Math.max(0, directLight);

    var specularLight = Math.max(normal.dot(light), 0);
    specularLight = Math.pow(specularLight, 50);

    var totalLight = directLight * 0.8 + 0.2 + specularLight * 0.9;
    var res = (totalLight) * 255;

    if (samplePoint.hit) {
        return `rgb(${res}, ${res}, ${res})`;
    } else {
        return `rgb(50, 50, 80)`;
    }
}

// shading for step map visualization
function shadeSteps (samplePoint) {
    var res = samplePoint.steps / 100 * 255;
    return `rgb(${res}, ${res}, ${res})`;
}


// render the scene to create output images
function render() {
    for (let x = 0; x < render1.width; x++) {
        for (let y = 0; y < render1.height; y++) {
            let ray1 = sample(x / render1.width, y / render1.height, raymarch);
            let ray2 = sample(x / testmap1.width, y / testmap1.height, binarycast);

            // --- method 1 - raycast --- //
            ctx1.fillStyle = shade(ray1);
            ctx1.fillRect(x, y, 1, 1);

            // draw step map
            ctx3.fillStyle = shadeSteps(ray1);
            ctx3.fillRect(x, y, 1, 1);

            // --- method 2 - binarycast --- //

            // render 
            ctx2.fillStyle = shade(ray2);
            ctx2.fillRect(x, y, 1, 1);

            // draw step map
            ctx4.fillStyle = shadeSteps(ray2);
            ctx4.fillRect(x, y, 1, 1);
        }
    }
}


// Generate data and output images

// brew install pkg-config cairo pango libpng jpeg giflib librsvg
if (typeof window !== "undefined") {
    render();
    // fs.writeFileSync(OUTPUT_PATH + "./method1_render.png", render1.toBuffer("image/png"));
    // fs.writeFileSync(OUTPUT_PATH + "./method1_testmap.png", testmap1.toBuffer("image/png"));
    // fs.writeFileSync(OUTPUT_PATH + "./method2_render.png", render2.toBuffer("image/png"));
    // fs.writeFileSync(OUTPUT_PATH + "./method2_testmap.png", testmap2.toBuffer("image/png"));
}