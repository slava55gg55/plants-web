// grow_logic.js
// Процедурный визуал растений (canvas). Три типа: flower/tree, succulent, algae.
// Чистый JS, без зависимостей.

(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 900, H = 520;
  function fit() { 
    const r = canvas.getBoundingClientRect();
    W = Math.max(300, Math.floor(r.width));
    H = Math.max(260, Math.floor(r.height));
    canvas.width = W; canvas.height = H;
  }
  fit();
  window.addEventListener('resize', () => { fit(); render(); });

  // UI
  const lightIn = document.getElementById('light');
  const spectrumIn = document.getElementById('spectrum');
  const tempIn = document.getElementById('temp');
  const humidityIn = document.getElementById('humidity');
  const plantSel = document.getElementById('plantType');
  const resetBtn = document.getElementById('resetBtn');
  const growFast = document.getElementById('growFast');

  const biomEl = document.getElementById('biom');
  const healthEl = document.getElementById('health');
  const modeEl = document.getElementById('mode');

  // State
  let running = true;
  let time = 0;
  let speed = 1;
  let plant = null;

  // Helpers
  function rand(a,b){return a + Math.random()*(b-a)}
  function lerp(a,b,t){return a + (b-a)*t}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

  // Plant models
  function createPlant(type) {
    const baseX = W/2;
    const groundY = H * (type === 'algae' ? 0.9 : 0.88);
    if(type === 'algae'){
      // group of blades
      const blades = [];
      const count = 18;
      for(let i=0;i<count;i++){
        blades.push({
          x: baseX - 200 + i*(400/count),
          length: rand(60,200),
          phase: Math.random()*Math.PI*2,
          thickness: rand(4,10),
          hue: rand(160,200),
          growth: 0.01 + Math.random()*0.02
        });
      }
      return { type, blades, baseX, groundY, biomass:0.1, health:1 };
    }

    // tree / succulent: node-based branching
    const nodes = [];
    const trunk = {
      x: baseX, y: groundY, angle: -Math.PI/2, len: rand(14,24), thickness: rand(8,14),
      parent: null, depth: 0, energy: 1.0, grown:0, id:0
    };
    nodes.push(trunk);
    return { type, nodes, baseX, groundY, nextId:1, biomass:0.05, health:1, lastBranchTime:0 };
  }

  function reset() { plant = createPlant(plantSel.value); time = 0; render(); }
  reset();

  resetBtn.onclick = reset;
  plantSel.onchange = reset;
  growFast.onclick = () => { speed = speed === 1 ? 6 : 1; growFast.textContent = speed===1 ? 'Ускорить рост' : 'Норм скорость'; };

  // Growth rules
  function update(dt) {
    if(!plant) return;
    const light = +lightIn.value/100; // 0..1
    const spectrum = +spectrumIn.value/100; // 0..1 (red->blue)
    const temp = +tempIn.value;
    const humidity = +humidityIn.value/100;
    // simple health model
    const tempOpt = (plant.type==='algae'?18:22);
    const tempFactor = Math.exp(-Math.pow((temp - tempOpt)/8,2));
    plant.health = clamp( (plant.health*0.98 + tempFactor*0.02) , 0.05, 1);

    if(plant.type === 'algae'){
      plant.biomass += 0.0006 * light * dt * (1 + spectrum*0.6);
      for(const b of plant.blades){
        // growth adds to length
        b.length = clamp(b.length + b.growth * dt * (0.8 + light*1.2), 0, 600);
      }
      return;
    }

    // for tree/flower/succulent: node growth
    plant.biomass += 0.0008 * dt * light;

    // iterate nodes; tips grow
    const tips = plant.nodes.filter(n => !plant.nodes.some(ch => ch.parent===n.id));
    for(const t of tips){
      // growth speed depends on health and light
      const growthSpeed = 0.6 * plant.health * light * (plant.type==='succulent'?0.35:1.0);
      t.grown += growthSpeed * dt * 0.05;
      // extend tip
      if(t.grown > 1){
        // create new tip or branch
        const branchProb = 0.18 * (plant.type==='succulent'?0.03:1) * (1 - t.depth*0.12);
        // direction influenced by spectrum: blue -> more upward, red -> more lateral
        const spectrumBias = lerp(-0.35, 0.25, spectrum); // negative -> left bias, positive -> up bias
        const lightBias = lerp(-0.4,0.4, (0.5 - (light - 0.5)) ); // slight shift based on light distribution
        let angleVar = rand(-0.7,0.7) + spectrumBias + lightBias;
        const newAngle = t.angle + angleVar * (1 - t.depth*0.15);
        const newLen = t.len? t.len * lerp(0.6, 1.05, Math.random()) : rand(8,20) * (plant.type==='succulent'?0.6:1);
        const newThickness = Math.max(1, t.thickness * 0.75);
        const nx = t.x + Math.cos(newAngle) * newLen;
        const ny = t.y + Math.sin(newAngle) * newLen;
        const nid = plant.nextId++;
        const node = { x: nx, y: ny, angle: newAngle, len: newLen, thickness: newThickness, parent: t.id, depth: t.depth+1, grown:0, id: nid };
        plant.nodes.push(node);
        t.grown = 0;
        // sometimes create lateral branch
        if(Math.random() < branchProb && t.depth < 6){
          const bangle = t.angle + rand(-1.6,1.6);
          const blen = newLen * rand(0.6,0.95);
          const bx = t.x + Math.cos(bangle)*blen;
          const by = t.y + Math.sin(bangle)*blen;
          const bid = plant.nextId++;
          plant.nodes.push({ x: bx, y: by, angle: bangle, len: blen, thickness: newThickness*0.8, parent: t.id, depth: t.depth+1, grown:0, id: bid });
        }
      }
    }

    // prune if too many nodes
    if(plant.nodes.length > 1000){
      plant.nodes.splice(200, plant.nodes.length-200);
    }
  }

  // Render utilities
  function drawBackground() {
    // sky / water depending on type
    if(plant.type === 'algae'){
      // water gradient
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#073b59');
      g.addColorStop(0.6,'#06425a');
      g.addColorStop(1,'#02324a');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,W,H);
      // sea floor
      ctx.fillStyle = '#2b241a';
      ctx.fillRect(0, plant.groundY, W, H - plant.groundY);
    } else {
      // ground + sky
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#0b2230');
      g.addColorStop(0.6,'#08303a');
      g.addColorStop(1,'#071a1d');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,W,H);
      // ground strip
      ctx.fillStyle = '#0c2a1a';
      ctx.fillRect(0, plant.groundY, W, H - plant.groundY);
    }
  }

  function drawAlgae(p) {
    const t = performance.now()/1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(const b of p.blades){
      const sway = Math.sin(t*1.2 + b.phase) * 12 * (0.5 + ( +lightIn.value/100 ));
      const x0 = b.x;
      const y0 = p.groundY;
      const cpX = x0 + sway*0.6;
      const cpY = y0 - b.length*0.4;
      const tipX = x0 + sway;
      const tipY = y0 - b.length;
      // blade
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
      ctx.lineWidth = b.thickness;
      ctx.strokeStyle = `hsl(${b.hue}deg 60% 40% / 0.95)`;
      ctx.lineCap = 'round';
      ctx.stroke();
      // thin highlight
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cpX*0.98, cpY*0.98, tipX*0.98, tipY*0.98);
      ctx.lineWidth = Math.max(1, b.thickness*0.35);
      ctx.strokeStyle = `hsla(${b.hue-30}deg,60%,70%,0.25)`;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTree(p) {
    // draw branches from root up
    ctx.save();
    // draw branches thicker -> thinner by depth
    const nodes = p.nodes;
    // compute order so parents drawn first
    nodes.sort((a,b)=> (a.depth - b.depth));
    for(const n of nodes){
      if(n.parent === null) continue;
      const parent = nodes.find(x=>x.id===n.parent) || {x:p.baseX,y:p.groundY};
      const grad = ctx.createLinearGradient(parent.x,parent.y,n.x,n.y);
      const hue = plant.type==='succulent'?120:100;
      grad.addColorStop(0, `hsl(${hue-20}deg 40% 18%)`);
      grad.addColorStop(1, `hsl(${hue-5}deg 45% 28%)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = clamp(n.thickness, 1, 18);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      // slight curvature
      const cx = (parent.x + n.x)/2 + Math.sin(n.depth*1.7 + time*0.01)*6;
      const cy = (parent.y + n.y)/2 + Math.cos(n.depth*1.3 + time*0.01)*6;
      ctx.quadraticCurveTo(cx, cy, n.x, n.y);
      ctx.stroke();
    }

    // leaves: tips produce leaves
    const tips = nodes.filter(n => !nodes.some(ch => ch.parent===n.id));
    for(const t of tips){
      // leaf parameters depend on type
      const leafCount = plant.type==='succulent'?3: (t.depth>2? Math.round(1+Math.random()*2): Math.round(2+Math.random()*3));
      for(let i=0;i<leafCount;i++){
        const angle = t.angle + (Math.random()-0.5)*1.4;
        const len = (plant.type==='succulent'?8:14) * (1 - t.depth*0.06) * (0.7 + Math.random()*0.6);
        const lx = t.x + Math.cos(angle)*len;
        const ly = t.y + Math.sin(angle)*len;
        // leaf shape
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        const cpx = t.x + Math.cos(angle)*len*0.4 - Math.sin(angle)*len*0.2;
        const cpy = t.y + Math.sin(angle)*len*0.4 + Math.cos(angle)*len*0.2;
        ctx.quadraticCurveTo(cpx, cpy, lx, ly);
        ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
        // leaf color driven by health and spectrum
        const s = +spectrumIn.value/100;
        const green = clamp(50 + plant.health*30 + s*10, 30, 80);
        const sat = plant.type==='succulent'?70:65;
        ctx.fillStyle = `hsl(${green}  ${sat}%  ${plant.health*30+30}%)`;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function render() {
    if(!plant) return;
    drawBackground();
    if(plant.type === 'algae') drawAlgae(plant);
    else drawTree(plant);

    // subtle overlay sun based on light
    const L = +lightIn.value/100;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `rgba(255,235,180,${0.02 + 0.08*L})`;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // loop
  let last = performance.now();
  function loop(now){
    const dtms = now - last;
    last = now;
    const dt = (dtms/16) * speed; // normalized steps
    time += dt;
    update(dt);
    render();
    // update UI values occasionally
    biomEl.textContent = plant ? plant.biomass.toFixed(3) : '0.00';
    healthEl.textContent = plant ? Math.round(plant.health*100) : '100';
    modeEl.textContent = plant ? plant.type : '—';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // initial placement adjustments
  function normalizePlantOnResize(){
    if(!plant) return;
    plant.baseX = W/2;
    plant.groundY = H*(plant.type==='algae'?0.9:0.88);
    // reposition trunk root
    if(plant.nodes && plant.nodes.length){
      plant.nodes[0].x = plant.baseX;
      plant.nodes[0].y = plant.groundY;
    }
  }
  window.addEventListener('resize', () => { fit(); normalizePlantOnResize(); });

  // reset logic updated to new createPlant
  resetBtn.addEventListener('click', () => { plant = createPlant(plantSel.value); });

  // quick start: reset when changing sliders that drastically affect look
  [lightIn, spectrumIn, tempIn, humidityIn, plantSel].forEach(el => {
    el.addEventListener('input', () => {
      // for major change, keep plant but tweak health/biomass slightly
      if(plant) {
        plant.health = clamp(plant.health * 0.997 + (+tempIn.value/40)*0.003, 0.01, 1);
      }
    });
  });

})();
