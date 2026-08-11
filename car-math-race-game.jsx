import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { ChevronLeft, ChevronRight, Heart, Trophy, RotateCcw, Zap, Pause, Play, LogOut } from "lucide-react";

/* ================= ค่าคงที่เกม ================= */
const LANE_X = 1.7;
const CAR_Z = 5;
const BASE_SPEED = 6.2; // หน่วย/วินาที
const MAX_SPEED_MUL = 2.4; // เพดานความเร็วสูงสุด
const BOOST_MULTIPLIER = 1.7; // ตัวคูณความเร็วตอนกดเร่ง
const SPEED_STEP = 0.09; // เพิ่มความเร็วต่อ 1 คำตอบถูก
const GATE_SPAWN_Z = -70;
const GATE_RESET_DELAY = 1100; // ms หลังประเมินผลก่อนเกิดโจทย์ใหม่

/* ================= สุ่มโจทย์ ป.1 บวก-ลบ ================= */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ================= ระดับชั้นและความยาก ================= */
const GRADES = [
  { id: 1, label: "ป.1", desc: "บวก-ลบ ไม่เกิน 20" },
  { id: 2, label: "ป.2", desc: "บวก-ลบ ไม่เกิน 100" },
  { id: 3, label: "ป.3", desc: "บวก-ลบ หลักพัน / คูณสูตร 2-5" },
  { id: 4, label: "ป.4", desc: "คูณ-หาร / บวกลบหลักหมื่น" },
  { id: 5, label: "ป.5", desc: "คูณ-หาร เลข 2 หลัก" },
  { id: 6, label: "ป.6", desc: "คูณ-หารเลขใหญ่ / บวกลบหลักแสน" },
];

/* ================= สุ่มโจทย์ตามระดับชั้น ป.1-6 ================= */
function generateQuestion(grade, subLevel = 0) {
  const lvl = Math.max(0, Math.min(2, subLevel));
  let a, b, op, correct, spread;

  switch (grade) {
    case 1: {
      const r = [
        { addMax: 5, subA: [3, 6], addProb: 0.75, spread: 4 },
        { addMax: 7, subA: [4, 8], addProb: 0.6, spread: 5 },
        { addMax: 9, subA: [3, 10], addProb: 0.55, spread: 6 },
      ][lvl];
      if (Math.random() < r.addProb) {
        a = randInt(1, r.addMax); b = randInt(1, r.addMax); correct = a + b; op = "+";
      } else {
        a = randInt(r.subA[0], r.subA[1]); b = randInt(1, a); correct = a - b; op = "-";
      }
      spread = r.spread;
      break;
    }
    case 2: {
      const r = [
        { aMax: 40, bMax: 30, subMax: 60, addProb: 0.7, spread: 8 },
        { aMax: 65, bMax: 45, subMax: 85, addProb: 0.6, spread: 12 },
        { aMax: 90, bMax: 60, subMax: 99, addProb: 0.55, spread: 15 },
      ][lvl];
      if (Math.random() < r.addProb) {
        a = randInt(10, r.aMax); b = randInt(5, r.bMax);
        correct = a + b;
        if (correct > 100) { b = randInt(1, Math.max(1, 100 - a)); correct = a + b; }
        op = "+";
      } else {
        a = randInt(20, r.subMax); b = randInt(1, a); correct = a - b; op = "-";
      }
      spread = r.spread;
      break;
    }
    case 3: {
      const r = [
        { addA: [100, 300], mulA: [2, 3], mulProb: 0.25, spread: 12 },
        { addA: [200, 600], mulA: [2, 4], mulProb: 0.35, spread: 20 },
        { addA: [300, 900], mulA: [2, 5], mulProb: 0.4, spread: 25 },
      ][lvl];
      if (Math.random() < r.mulProb) {
        a = randInt(r.mulA[0], r.mulA[1]); b = randInt(1, 10); correct = a * b; op = "×";
      } else if (Math.random() < 0.55) {
        a = randInt(r.addA[0], r.addA[1]); b = randInt(50, Math.max(51, Math.round(r.addA[1] * 0.6))); correct = a + b; op = "+";
      } else {
        a = randInt(r.addA[0] + 50, r.addA[1] + 100); b = randInt(50, a); correct = a - b; op = "-";
      }
      spread = r.spread;
      break;
    }
    case 4: {
      const r = [
        { mulA: [2, 5], mulB: [2, 6], divB: [2, 5], divBase: [2, 8], addA: [1000, 3000], mix: [0.35, 0.65], spread: 18 },
        { mulA: [2, 7], mulB: [2, 9], divB: [2, 7], divBase: [2, 10], addA: [3000, 6000], mix: [0.4, 0.7], spread: 28 },
        { mulA: [2, 9], mulB: [2, 12], divB: [2, 9], divBase: [2, 12], addA: [3000, 9000], mix: [0.4, 0.7], spread: 35 },
      ][lvl];
      const kind = Math.random();
      if (kind < r.mix[0]) {
        a = randInt(r.mulA[0], r.mulA[1]); b = randInt(r.mulB[0], r.mulB[1]); correct = a * b; op = "×";
      } else if (kind < r.mix[1]) {
        b = randInt(r.divB[0], r.divB[1]); const ansBase = randInt(r.divBase[0], r.divBase[1]); a = b * ansBase; correct = ansBase; op = "÷";
      } else if (Math.random() < 0.5) {
        a = randInt(r.addA[0], r.addA[1]); b = randInt(500, Math.max(501, Math.round(r.addA[1] * 0.6))); correct = a + b; op = "+";
      } else {
        a = randInt(r.addA[0] + 500, r.addA[1] + 1000); b = randInt(500, a); correct = a - b; op = "-";
      }
      spread = r.spread;
      break;
    }
    case 5: {
      const r = [
        { mul: [11, 20], divB: [4, 8], divBase: [10, 20], mulProb: 0.55, spread: 20 },
        { mul: [11, 30], divB: [4, 12], divBase: [10, 30], mulProb: 0.5, spread: 35 },
        { mul: [11, 40], divB: [4, 15], divBase: [10, 40], mulProb: 0.5, spread: 45 },
      ][lvl];
      if (Math.random() < r.mulProb) {
        a = randInt(r.mul[0], r.mul[1]); b = randInt(r.mul[0], r.mul[1]); correct = a * b; op = "×";
      } else {
        b = randInt(r.divB[0], r.divB[1]); const ansBase = randInt(r.divBase[0], r.divBase[1]); a = b * ansBase; correct = ansBase; op = "÷";
      }
      spread = r.spread;
      break;
    }
    default: {
      const r = [
        { mul: [20, 40], divB: [6, 12], divBase: [15, 30], addA: [5000, 20000], mix: [0.3, 0.6], spread: 30 },
        { mul: [20, 55], divB: [6, 18], divBase: [15, 45], addA: [10000, 40000], mix: [0.32, 0.62], spread: 45 },
        { mul: [20, 90], divB: [6, 25], divBase: [15, 60], addA: [20000, 90000], mix: [0.35, 0.65], spread: 60 },
      ][lvl];
      const kind = Math.random();
      if (kind < r.mix[0]) {
        a = randInt(r.mul[0], r.mul[1]); b = randInt(r.mul[0], r.mul[1]); correct = a * b; op = "×";
      } else if (kind < r.mix[1]) {
        b = randInt(r.divB[0], r.divB[1]); const ansBase = randInt(r.divBase[0], r.divBase[1]); a = b * ansBase; correct = ansBase; op = "÷";
      } else if (Math.random() < 0.5) {
        a = randInt(r.addA[0], r.addA[1]); b = randInt(2000, Math.max(2001, Math.round(r.addA[1] * 0.6))); correct = a + b; op = "+";
      } else {
        a = randInt(r.addA[0] + 2000, r.addA[1] + 5000); b = randInt(2000, a); correct = a - b; op = "-";
      }
      spread = r.spread;
    }
  }

  let wrong, guard = 0;
  do {
    const delta = randInt(1, spread) * (Math.random() < 0.5 ? 1 : -1) || spread;
    wrong = correct + delta;
    guard++;
  } while ((wrong < 0 || wrong === correct) && guard < 25);
  if (wrong < 0 || wrong === correct) wrong = correct + spread + 1;

  const correctOnLeft = Math.random() < 0.5;
  return {
    a,
    b,
    op,
    correct,
    leftVal: correctOnLeft ? correct : wrong,
    rightVal: correctOnLeft ? wrong : correct,
    correctLane: correctOnLeft ? -1 : 1,
  };
}

/* ================= สร้างพื้นผิวข้อความบนป้าย ================= */
function makeSignTexture(text, bg, textColor = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const r = 40;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(256, 0, 256, 256, r);
  ctx.arcTo(256, 256, 0, 256, r);
  ctx.arcTo(0, 256, 0, 0, r);
  ctx.arcTo(0, 0, 256, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = "bold 130px 'Arial'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text), 128, 138);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ================= React Component ================= */
export default function CarMathRaceGame() {
  const mountRef = useRef(null);
  const threeRef = useRef({});
  const [uiState, setUiState] = useState("start"); // start | playing | paused | gameover
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [question, setQuestion] = useState(null);
  const [flash, setFlash] = useState(null); // 'good' | 'bad'
  const [grade, setGrade] = useState(1);

  const uiStateRef = useRef(uiState);
  uiStateRef.current = uiState;
  const gradeRef = useRef(grade);
  const scoreRef = useRef(0);

  /* --------- setup three.js scene (once) --------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const skyColor = 0x8ed4f0;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 22, 75);

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 4.6, 10.5);
    camera.lookAt(0, 1.1, -8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    /* แสง */
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.9);
    sun.position.set(8, 14, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbcdcff, 0.35);
    fill.position.set(-6, 8, -4);
    scene.add(fill);

    /* พื้นหญ้า */
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x6bbf59, roughness: 1 });
    const grassGeo = new THREE.PlaneGeometry(60, 400);
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.01, -150);
    scene.add(grass);

    /* ถนน */
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.95 });
    const roadGeo = new THREE.PlaneGeometry(7.2, 400);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -150);
    scene.add(road);

    /* ขอบถนน */
    [-3.7, 3.7].forEach((x) => {
      const curbGeo = new THREE.BoxGeometry(0.35, 0.18, 400);
      const curbMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0 });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(x, 0.08, -150);
      scene.add(curb);
    });

    /* เส้นแบ่งเลนกลาง (ปะ) แบบรีไซเคิล */
    const dashGroup = new THREE.Group();
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dashes = [];
    for (let i = 0; i < 16; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 1.6), dashMat);
      dash.position.set(0, 0.02, -8 * i - 6);
      dashGroup.add(dash);
      dashes.push(dash);
    }
    scene.add(dashGroup);

    /* ต้นไม้ประดับ รีไซเคิลสองฝั่ง */
    const trees = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2b });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 8), trunkMat);
        trunk.position.y = 0.55;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.7, 8), leafMat);
        leaves.position.y = 1.7;
        g.add(trunk, leaves);
        const bx = side * (4.6 + Math.random() * 2.2);
        g.position.set(bx, 0, -12 * i - Math.random() * 4);
        scene.add(g);
        trees.push(g);

        if (Math.random() < 0.4) {
          const rock = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 6, 5), rockMat);
          rock.position.set(side * (3.9 + Math.random()), 0.15, -12 * i - 6);
          scene.add(rock);
          trees.push(rock);
        }
      }
    }

    /* ตัวละครผู้เล่น (คนวิ่ง) */
    const car = new THREE.Group(); // เก็บชื่อ car ไว้เพื่อไม่ต้องแก้ตรรกะเลน/ความเร็วทั้งไฟล์
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcfa0, roughness: 0.75 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xe8442f, roughness: 0.55 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.6 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.85 });

    const hip = new THREE.Group();
    hip.position.y = 0.95;
    car.add(hip);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), shirtMat);
    torso.position.set(0, 0.32, 0);
    hip.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skinMat);
    head.position.set(0, 0.82, 0.02);
    hip.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.set(0, 0.87, 0);
    hip.add(hair);

    /* แขน/ขา แบบมีจุดหมุน (pivot) เพื่อทำแอนิเมชันวิ่ง */
    function makeLimb(mat, length, radiusTop, radiusBottom, pivotPos, footMat) {
      const pivot = new THREE.Group();
      pivot.position.copy(pivotPos);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 8), mat);
      limb.position.set(0, -length / 2, 0);
      pivot.add(limb);
      if (footMat) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.22), footMat);
        foot.position.set(0, -length + 0.03, 0.05);
        pivot.add(foot);
      }
      return pivot;
    }

    const armL = makeLimb(skinMat, 0.5, 0.075, 0.06, new THREE.Vector3(-0.3, 0.58, 0));
    const armR = makeLimb(skinMat, 0.5, 0.075, 0.06, new THREE.Vector3(0.3, 0.58, 0));
    hip.add(armL, armR);

    const legL = makeLimb(pantsMat, 0.95, 0.11, 0.09, new THREE.Vector3(-0.15, 0, 0), shoeMat);
    const legR = makeLimb(pantsMat, 0.95, 0.11, 0.09, new THREE.Vector3(0.15, 0, 0), shoeMat);
    hip.add(legL, legR);

    car.position.set(-LANE_X, 0, CAR_Z);
    scene.add(car);

    /* --------- state สำหรับลูป --------- */
    threeRef.current = {
      renderer,
      scene,
      camera,
      car,
      hip,
      torso,
      legL,
      legR,
      armL,
      armR,
      gaitPhase: 0,
      dashes,
      trees,
      targetX: -LANE_X,
      laneSign: -1,
      gate: null,
      gateTimer: null,
      speedMul: 1,
      boosting: false,
      clock: new THREE.Clock(),
      running: false,
      raf: null,
    };

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    /* --------- ลูปเรนเดอร์ --------- */
    const animate = () => {
      threeRef.current.raf = requestAnimationFrame(animate);
      const t = threeRef.current;
      const delta = Math.min(t.clock.getDelta(), 0.05);

      if (uiStateRef.current === "playing") {
        const speedFactor = BASE_SPEED * t.speedMul * (t.boosting ? BOOST_MULTIPLIER : 1);
        const speed = speedFactor * delta;
        t.car.position.x += (t.targetX - t.car.position.x) * Math.min(1, delta * 9);
        t.car.rotation.z = (t.targetX - t.car.position.x) * -0.18;

        /* แอนิเมชันวิ่ง/เดิน: แขน-ขาสลับก้าว ยิ่งความเร็วสูงยิ่งก้าวถี่ */
        t.gaitPhase += delta * speedFactor * 1.7;
        const legSwing = Math.sin(t.gaitPhase);
        const maxLegAngle = 0.85;
        t.legL.rotation.x = legSwing * maxLegAngle;
        t.legR.rotation.x = -legSwing * maxLegAngle;
        t.armL.rotation.x = -legSwing * maxLegAngle * 0.75;
        t.armR.rotation.x = legSwing * maxLegAngle * 0.75;
        t.car.position.y = Math.abs(Math.sin(t.gaitPhase)) * 0.07;
        t.torso.rotation.x = -0.08 - Math.min(0.18, speedFactor * 0.015);

        t.dashes.forEach((d) => {
          d.position.z += speed;
          if (d.position.z > 10) d.position.z -= 8 * 16;
        });
        t.trees.forEach((obj) => {
          obj.position.z += speed;
          if (obj.position.z > 12) obj.position.z -= 12 * 8;
        });

        if (t.gate) {
          t.gate.group.position.z += speed;
          if (!t.gate.evaluated && t.gate.group.position.z >= CAR_Z - 0.4) {
            t.gate.evaluated = true;
            evaluateGate(t.gate);
          }
          if (t.gate.group.position.z > 14) {
            t.scene.remove(t.gate.group);
            t.gate = null;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(threeRef.current.raf);
      clearTimeout(threeRef.current.gateTimer);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------- สร้างประตูโจทย์ใหม่ --------- */
  const spawnGate = useCallback(() => {
    const t = threeRef.current;
    if (!t.scene) return;
    const subLevel = Math.min(2, Math.floor(scoreRef.current / 4));
    const q = generateQuestion(gradeRef.current, subLevel);
    setQuestion(q);

    // โจทย์ยิ่งยาก (subLevel สูง) เส้นทางก่อนถึงป้ายคำตอบยิ่งยาว ให้เวลาคิดมากขึ้น
    const extraDistance = subLevel * 18;
    const spawnZ = GATE_SPAWN_Z - extraDistance;
    const stripLength = 3 + subLevel * 7;

    const group = new THREE.Group();

    [-1, 1].forEach((side) => {
      const val = side === -1 ? q.leftVal : q.rightVal;
      const tex = makeSignTexture(val, "#3B6FE0");
      const mat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.5, 1.5, 1);
      sprite.position.set(side * LANE_X, 2.3, 0);
      sprite.userData.mat = mat;
      sprite.userData.side = side;
      group.add(sprite);

      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xdedede });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(side * LANE_X, 1.1, 0);
      group.add(pole);

      const stripGeo = new THREE.PlaneGeometry(2.6, stripLength);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * LANE_X, 0.02, -(stripLength - 3) / 2);
      group.add(strip);
    });

    group.position.z = spawnZ;
    threeRef.current.scene.add(group);
    threeRef.current.gate = { group, correctLane: q.correctLane, evaluated: false, q };
  }, []);

  /* --------- ประเมินผลเมื่อประตูถึงตัวละคร --------- */
  const evaluateGate = useCallback((gate) => {
    const t = threeRef.current;
    const carLane = t.laneSign;
    const isCorrect = carLane === gate.correctLane;

    gate.group.children.forEach((child) => {
      if (child.userData && child.userData.mat) {
        const good = child.userData.side === gate.correctLane;
        const tex = makeSignTexture(
          child.userData.side === -1 ? gate.q.leftVal : gate.q.rightVal,
          good ? "#22C55E" : "#EF4444"
        );
        child.userData.mat.map = tex;
        child.userData.mat.needsUpdate = true;
      }
    });

    if (isCorrect) {
      setScore((s) => {
        const ns = s + 1;
        scoreRef.current = ns;
        setBest((b) => Math.max(b, ns));
        return ns;
      });
      t.speedMul = Math.min(MAX_SPEED_MUL, t.speedMul + SPEED_STEP);
      setFlash("good");
    } else {
      setFlash("bad");
      setHearts((h) => {
        const nh = h - 1;
        if (nh <= 0) {
          setTimeout(() => {
            uiStateRef.current = "gameover";
            setUiState("gameover");
          }, 550);
        }
        return Math.max(0, nh);
      });
    }
    setTimeout(() => setFlash(null), 550);

    threeRef.current.gateTimer = setTimeout(() => {
      if (uiStateRef.current === "playing") spawnGate();
    }, GATE_RESET_DELAY);
  }, [spawnGate]);

  /* --------- ควบคุมเลน --------- */
  const steer = useCallback((dir) => {
    if (uiStateRef.current !== "playing") return;
    const t = threeRef.current;
    t.laneSign = dir;
    t.targetX = dir * LANE_X;
  }, []);

  /* --------- ปุ่มเร่งความเร็ว --------- */
  const [boostOn, setBoostOnState] = useState(false);
  const toggleBoost = useCallback(() => {
    if (uiStateRef.current !== "playing") return;
    const t = threeRef.current;
    t.boosting = !t.boosting;
    setBoostOnState(t.boosting);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") steer(-1);
      if (e.key === "ArrowRight" || e.key === "d") steer(1);
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") toggleBoost();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [steer, toggleBoost]);

  /* --------- เลือกระดับชั้น --------- */
  const selectGrade = useCallback((g) => {
    gradeRef.current = g;
    setGrade(g);
  }, []);

  /* --------- เริ่ม / เริ่มใหม่ --------- */
  const startGame = () => {
    const t = threeRef.current;
    setHearts(3);
    setScore(0);
    scoreRef.current = 0;
    setFlash(null);
    if (t.gate) {
      t.scene.remove(t.gate.group);
      t.gate = null;
    }
    clearTimeout(t.gateTimer);
    t.laneSign = -1;
    t.targetX = -LANE_X;
    t.speedMul = 1;
    t.boosting = false;
    t.gaitPhase = 0;
    setBoostOnState(false);
    if (t.car) t.car.position.set(-LANE_X, 0, CAR_Z);
    uiStateRef.current = "playing";
    setUiState("playing");
    spawnGate();
  };

  /* --------- หยุดชั่วคราว / เล่นต่อ --------- */
  const pauseGame = () => {
    if (uiStateRef.current !== "playing") return;
    uiStateRef.current = "paused";
    setUiState("paused");
  };

  const resumeGame = () => {
    if (uiStateRef.current !== "paused") return;
    uiStateRef.current = "playing";
    setUiState("playing");
    if (!threeRef.current.gate) spawnGate();
  };

  /* --------- ออกจากเกม กลับสู่เมนูหลัก --------- */
  const exitGame = () => {
    const t = threeRef.current;
    if (t.gate) {
      t.scene.remove(t.gate.group);
      t.gate = null;
    }
    clearTimeout(t.gateTimer);
    t.boosting = false;
    setBoostOnState(false);
    setQuestion(null);
    setFlash(null);
    uiStateRef.current = "start";
    setUiState("start");
  };

  return (
    <div style={{ fontFamily: "'Prompt', sans-serif" }} className="w-full h-screen relative overflow-hidden bg-black select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap');
        @keyframes popIn { 0%{ transform: scale(0.7); opacity:0;} 100%{ transform: scale(1); opacity:1;} }
        @keyframes heartPop { 0%{ transform: scale(1);} 50%{ transform: scale(1.4);} 100%{ transform: scale(1);} }
        .pop-in { animation: popIn 0.3s ease-out; }
        .heart-pop { animation: heartPop 0.35s ease-out; }
      `}</style>

      <div ref={mountRef} className="absolute inset-0" />

      {/* แฟลชผลลัพธ์ */}
      {flash && (
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{ background: flash === "good" ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.22)" }}
        />
      )}

      {(uiState === "playing" || uiState === "paused") && (
        <>
          {/* หัวใจ */}
          <div className="absolute top-3 left-3 flex gap-1.5 z-20">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                size={30}
                className={hearts > i ? "heart-pop" : ""}
                fill={hearts > i ? "#EF4444" : "none"}
                color={hearts > i ? "#EF4444" : "#ffffffaa"}
                strokeWidth={2.4}
              />
            ))}
          </div>

          {/* คะแนน */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl z-20" style={{ background: "rgba(255,255,255,0.9)" }}>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#F4A93E", color: "#4A2E0C" }}>ป.{grade}</span>
            <span style={{ fontSize: 11 }}>{"★".repeat(Math.min(2, Math.floor(score / 4)) + 1)}{"☆".repeat(2 - Math.min(2, Math.floor(score / 4)))}</span>
            <Trophy size={18} color="#D9A02A" />
            <span className="font-bold" style={{ color: "#2E1A47" }}>{score}</span>
          </div>

          {/* ปุ่มหยุด/เริ่มใหม่/ออกเกม */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            <button
              onClick={uiState === "paused" ? resumeGame : pauseGame}
              className="rounded-full shadow-lg active:scale-90 transition-transform flex items-center justify-center"
              style={{ width: 38, height: 38, background: "rgba(255,255,255,0.9)" }}
            >
              {uiState === "paused" ? (
                <Play size={18} color="#2E1A47" fill="#2E1A47" />
              ) : (
                <Pause size={18} color="#2E1A47" fill="#2E1A47" />
              )}
            </button>
            <button
              onClick={startGame}
              className="rounded-full shadow-lg active:scale-90 transition-transform flex items-center justify-center"
              style={{ width: 38, height: 38, background: "rgba(255,255,255,0.9)" }}
            >
              <RotateCcw size={18} color="#2E1A47" />
            </button>
            <button
              onClick={exitGame}
              className="rounded-full shadow-lg active:scale-90 transition-transform flex items-center justify-center"
              style={{ width: 38, height: 38, background: "rgba(255,255,255,0.9)" }}
            >
              <LogOut size={17} color="#C0392B" />
            </button>
          </div>

          {/* ป้ายโจทย์ */}
          {question && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pop-in">
              <div className="rounded-2xl px-3.5 py-1.5 shadow-lg flex items-center gap-1.5" style={{ background: "rgba(255,255,255,0.95)", border: "2px solid #F4A93E" }}>
                <span className="text-xl font-extrabold" style={{ color: "#2E1A47" }}>{question.a}</span>
                <span className="text-xl font-extrabold" style={{ color: "#2E1A47" }}>{question.op}</span>
                <span className="text-xl font-extrabold" style={{ color: "#2E1A47" }}>{question.b}</span>
                <span className="text-xl font-extrabold" style={{ color: "#2E1A47" }}>=</span>
                <span className="text-xl font-extrabold" style={{ color: "#E8442F" }}>?</span>
              </div>
            </div>
          )}

          {/* ป้ายบอกคำตอบซ้าย-ขวา ตรงมุมที่ต้องเลี้ยว */}
          {question && (
            <>
              <button
                onTouchStart={(e) => { e.preventDefault(); steer(-1); }}
                onMouseDown={() => steer(-1)}
                className="absolute top-16 left-3 z-20 pop-in flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <ChevronLeft size={22} color="#fff" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }} />
                <div
                  className="rounded-2xl shadow-xl flex items-center justify-center font-extrabold"
                  style={{ width: 56, height: 56, background: "#3B6FE0", color: "#fff", fontSize: 24, border: "3px solid rgba(255,255,255,0.85)" }}
                >
                  {question.leftVal}
                </div>
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); steer(1); }}
                onMouseDown={() => steer(1)}
                className="absolute top-16 right-3 z-20 pop-in flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <ChevronRight size={22} color="#fff" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }} />
                <div
                  className="rounded-2xl shadow-xl flex items-center justify-center font-extrabold"
                  style={{ width: 56, height: 56, background: "#3B6FE0", color: "#fff", fontSize: 24, border: "3px solid rgba(255,255,255,0.85)" }}
                >
                  {question.rightVal}
                </div>
              </button>
            </>
          )}

          {/* ปุ่มควบคุมมือถือ (แสดงเฉพาะตอนกำลังเล่นจริง) */}
          {uiState === "playing" && (
            <>
              <button
                onTouchStart={(e) => { e.preventDefault(); steer(-1); }}
                onMouseDown={() => steer(-1)}
                className="absolute bottom-6 left-5 z-20 rounded-full shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                style={{ width: 72, height: 72, background: "rgba(255,255,255,0.9)" }}
              >
                <ChevronLeft size={38} color="#2E1A47" />
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); steer(1); }}
                onMouseDown={() => steer(1)}
                className="absolute bottom-6 right-5 z-20 rounded-full shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                style={{ width: 72, height: 72, background: "rgba(255,255,255,0.9)" }}
              >
                <ChevronRight size={38} color="#2E1A47" />
              </button>

              {/* ปุ่มเร่งความเร็ว (แตะเพื่อสลับเปิด/ปิด ไม่ต้องกดค้าง) */}
              <button
                onClick={toggleBoost}
                className="absolute bottom-24 left-5 z-20 rounded-full shadow-xl active:scale-90 transition-transform flex flex-col items-center justify-center"
                style={{
                  width: 84,
                  height: 84,
                  background: boostOn ? "linear-gradient(180deg,#FFB84D,#E8442F)" : "linear-gradient(180deg,#FF7A45,#E8442F)",
                  border: boostOn ? "3px solid #FFE9C7" : "3px solid rgba(255,255,255,0.85)",
                  boxShadow: boostOn ? "0 0 22px 6px rgba(255,160,60,0.75)" : undefined,
                }}
              >
                <Zap size={30} color="#fff" fill="#fff" />
                <span className="text-[11px] font-bold text-white mt-0.5">{boostOn ? "กำลังเร่ง" : "เร่ง!"}</span>
              </button>
            </>
          )}
        </>
      )}

      {/* หน้าจอเริ่มเกม */}
      {uiState === "start" && (
        <div className="absolute inset-0 flex items-center justify-center z-30 px-3" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full max-w-sm rounded-3xl p-6 pop-in text-center" style={{ background: "#FFF9EE", border: "4px solid #F4A93E" }}>
            <div style={{ fontSize: 46 }}>🏃</div>
            <p className="font-extrabold text-xl mt-1" style={{ color: "#2E1A47" }}>วิ่งฝ่าด่านคณิตศาสตร์</p>
            <p className="text-xs mt-1.5" style={{ color: "#5C3B22" }}>
              บังคับตัวละครไปเลนที่มี "คำตอบ" ถูกต้อง ตอบผิด 3 ครั้ง = จบเกม!<br />โจทย์จะเริ่มจากง่ายแล้วค่อยๆ ยากขึ้นเรื่อยๆ
            </p>

            <p className="text-sm font-bold mt-4 mb-2" style={{ color: "#2E1A47" }}>เลือกระดับชั้น</p>
            <div className="grid grid-cols-3 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGrade(g.id)}
                  className="rounded-xl py-2 px-1 flex flex-col items-center transition-transform active:scale-95"
                  style={{
                    background: grade === g.id ? "#F4A93E" : "#FFE9C7",
                    border: grade === g.id ? "2px solid #C9791E" : "2px solid transparent",
                  }}
                >
                  <span className="font-extrabold text-sm" style={{ color: "#4A2E0C" }}>{g.label}</span>
                  <span className="text-[10px] leading-tight mt-0.5" style={{ color: "#6B4A22" }}>{g.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-4 mt-4 text-sm font-semibold" style={{ color: "#4A2E0C" }}>
              <span>⬅️ ปุ่มซ้าย</span>
              <span>➡️ ปุ่มขวา</span>
            </div>
            <button
              onClick={startGame}
              className="mt-4 px-6 py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
              style={{ background: "#F4A93E", color: "#4A2E0C" }}
            >
              🏁 เริ่มเกม
            </button>
          </div>
        </div>
      )}

      {/* หน้าจอหยุดชั่วคราว (โจทย์ยังโชว์อยู่ด้านบนให้คิดต่อได้) */}
      {uiState === "paused" && (
        <div className="absolute inset-0 flex items-end justify-center z-30 px-3 pb-24 pointer-events-none">
          <div className="w-full max-w-sm rounded-3xl p-5 pop-in text-center pointer-events-auto" style={{ background: "rgba(255,249,238,0.98)", border: "3px solid #F4A93E" }}>
            <p className="font-extrabold text-lg" style={{ color: "#2E1A47" }}>⏸️ หยุดเกมชั่วคราว</p>
            <p className="text-xs mt-0.5" style={{ color: "#5C3B22" }}>ดูโจทย์ด้านบนแล้วค่อยกดเล่นต่อได้เลย</p>
            <div className="flex gap-2.5 mt-3">
              <button
                onClick={resumeGame}
                className="flex-1 px-4 py-2.5 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
                style={{ background: "#F4A93E", color: "#4A2E0C" }}
              >
                <Play size={18} fill="#4A2E0C" /> เล่นต่อ
              </button>
              <button
                onClick={startGame}
                className="flex-1 px-4 py-2.5 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
                style={{ background: "#FFE9C7", color: "#4A2E0C" }}
              >
                <RotateCcw size={18} /> เริ่มใหม่
              </button>
            </div>
            <button
              onClick={exitGame}
              className="w-full mt-2.5 px-4 py-2.5 rounded-2xl font-bold active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
              style={{ background: "transparent", color: "#C0392B", border: "2px solid #F3C6C0" }}
            >
              <LogOut size={17} /> ออกเกม
            </button>
          </div>
        </div>
      )}

      {/* หน้าจอแพ้ */}
      {uiState === "gameover" && (
        <div className="absolute inset-0 flex items-center justify-center z-30 px-3" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-sm rounded-3xl p-6 pop-in text-center" style={{ background: "#FFF9EE", border: "4px solid #F4A93E" }}>
            <div style={{ fontSize: 46 }}>💥</div>
            <p className="font-extrabold text-xl mt-1" style={{ color: "#2E1A47" }}>หัวใจหมดแล้ว!</p>
            <div className="mt-2 flex justify-center gap-6 text-sm font-semibold" style={{ color: "#4A2E0C" }}>
              <span>คะแนนรอบนี้: {score}</span>
              <span>คะแนนสูงสุด: {best}</span>
            </div>

            <p className="text-sm font-bold mt-4 mb-2" style={{ color: "#2E1A47" }}>เลือกระดับชั้นใหม่</p>
            <div className="grid grid-cols-3 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGrade(g.id)}
                  className="rounded-xl py-2 px-1 flex flex-col items-center transition-transform active:scale-95"
                  style={{
                    background: grade === g.id ? "#F4A93E" : "#FFE9C7",
                    border: grade === g.id ? "2px solid #C9791E" : "2px solid transparent",
                  }}
                >
                  <span className="font-extrabold text-sm" style={{ color: "#4A2E0C" }}>{g.label}</span>
                  <span className="text-[10px] leading-tight mt-0.5" style={{ color: "#6B4A22" }}>{g.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={startGame}
              className="mt-4 px-6 py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform inline-flex items-center gap-2"
              style={{ background: "#F4A93E", color: "#4A2E0C" }}
            >
              <RotateCcw size={18} /> เริ่มใหม่
            </button>
            <button
              onClick={exitGame}
              className="w-full mt-2.5 px-4 py-2.5 rounded-2xl font-bold active:scale-95 transition-transform inline-flex items-center justify-center gap-2"
              style={{ background: "transparent", color: "#C0392B", border: "2px solid #F3C6C0" }}
            >
              <LogOut size={17} /> ออกเกม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
