// simple visual plant simulator (pure JS + SVG)
// replace / plug into index.html
(() => {
  const scene = document.getElementById('scene');
  const rootGroup = document.getElementById('plantRoot');
  const waterGroup = document.getElementById('waterGroup');

  const lightEl = document.getElementById('light');
  const tempEl = document.getElementById('temp');
  const humEl = document.getElementById('hum');
  const typeEl = document.getElementById('plantType');

  const biomEl = document.getElementById('biom');
  const healthEl = document.getElementById('health');
  const modeEl = document.getElementById('mode');
  const restartBtn = document.getElementById('restart');

  let state = {
    type: typeEl.value,
    light: +lightEl.value,
    temp: +tempEl.value,
    hum: +humEl.value,
    time: 0,
    biomass: 0.05,
    running: true,
  };

  // presets
  const presets = {
    herb: { pmax: 7, angle: 18, branchProb: 0.45, maxDepth: 4, thickness: 8, leafSize: 12 },
    succulent: { pmax: 3.5, angle: 14, branchProb: 0.2, maxDepth: 3, thickness: 12, leafSize: 18 },
    algae: { pmax: 12, angle: 8, branchProb: 0.1, maxDepth: 12, thickness: 2, leafSize: 6 },
    tree: { pmax: 5, angle: 20, branchProb: 0.6, maxDepth: 6, thickness: 10, leafSize: 10 }
  };

  // utility: clear root
  function clearScene(){
    while(rootGroup.firstChild) rootGroup.removeChild(rootGroup.firstChild);
  }

  // map helper
  function lerp(a,b,t){return a+(b-a)*t}

  // simple growth function (returns growth factor 0..1)
  function growthFactor(){
    // light, temp, hum mapped to [0..1]
    const L = Math.max(0, Math.min(1, state.light/800));
    const T = Math.max(0, Math.min(1, 1 - Math.abs(state.temp - 25)/20)); // peak at 25
    const H = Math.max(0, Math.min(1, state.hum/90));
    // weighted product
    return L * 0.6 + T * 0.3 + H * 0.1;
  }

  // draw recursive branching (SVG paths)
  function drawBranch(x,y, length, angleDeg, depth, params, growth, branchColor){
    // create a path for the segment from (x,y) to new point
    const rad = angleDeg * Math.PI/180;
    const nx = x - Math.sin(rad)*length;
    const ny = y - Math.cos(rad)*length;

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M ${x} ${y} L ${nx} ${ny}`);
    const thickness = Math.max(1, (params.thickness * (1 - depth/ (params.maxDepth+1))) * (0.5+growth*0.5));
    path.setAttribute('stroke', branchColor);
    path.setAttribute('stroke-width', thickness);
    path.setAttribute('fill', 'none');
    path.classList.add('branch');
    rootGroup.appendChild(path);

    // add leaf if near end and not algae
    if(depth >= params.maxDepth - 1 && state.type !== 'algae'){
      const leaf = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      const lx = nx - Math.sin(rad)*(params.leafSize*0.3);
      const ly = ny - Math.cos(rad)*(params.leafSize*0.3);
      leaf.setAttribute('cx', lx);
      leaf.setAttribute('cy', ly);
      leaf.setAttribute('rx', params.leafSize * (0.6 + 0.4*Math.random()));
      leaf.setAttribute('ry', params.leafSize * (0.3 + 0.3*Math.random()));
      leaf.setAttribute('transform', `rotate(${(Math.random()*40-20)+ (angleDeg* -1)} ${lx} ${ly})`);
      leaf.setAttribute('fill', 'url(#leafGrad)');
      leaf.classList.add('leaf');
      rootGroup.appendChild(leaf);
    }

    // branching
    if(depth < params.maxDepth){
      const branches = Math.random() < params.branchProb ? 2 : 1;
      for(let i=0;i<branches;i++){
        const sign = i===0 ? -1 : 1;
        const baseAngle = angleDeg + sign * (params.angle + Math.random()*12);
        // length reduces per depth, growth scales
        const nLen = length * (0.6 + 0.15*Math.random()) * (0.5 + growth*0.8);
        // recursion with slight randomness
        drawBranch(nx, ny, nLen, baseAngle, depth+1, params, growth, branchColor);
      }
    }
  }

  // algae: create waving fronds in water
  function drawAlgae(params, growth){
    // show water
    waterGroup.style.opacity = 1.0;
    // multiple fronds
    const frondCount = Math.round(6 + growth*18);
    for(let i=0;i<frondCount;i++){
      const x = 200 + i * (400/frondCount) + (Math.random()*40-20);
      const baseY = 560;
      const height = lerp(60, 240, growth) * (0.7 + Math.random()*0.6);
      const controlX = x + (Math.random()*80-40);
      const controlY = baseY - height * (0.5 + Math.random()*0.4);
      const tipX = x + (Math.random()*40-20);
      const tipY = baseY - height;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${x} ${baseY} Q ${controlX} ${controlY} ${tipX} ${tipY}`;
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#2a9df4');
      path.setAttribute('stroke-width', Math.max(1, params.thickness * (0.4 + Math.random())));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('opacity', 0.9);
      // animation via path length dashoffset trick
      path.style.strokeDasharray = 1000;
      path.style.strokeDashoffset = 1000 - growth*900;
      path.style.transition = 'stroke-dashoffset 0.6s linear';
      rootGroup.appendChild(path);

      // small leaf shapes near tip
      if(Math.random() > 0.4){
        const circ = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
        circ.setAttribute('cx', tipX);
        circ.setAttribute('cy', tipY);
        circ.setAttribute('rx', 6 + Math.random()*6);
        circ.setAttribute('ry', 3 + Math.random()*3);
        circ.setAttribute('fill','#66c7ff');
        circ.setAttribute('opacity',0.9);
        rootGroup.appendChild(circ);
      }
    }
  }

  // build plant based on state.type
  function buildPlant(){
    clearScene();
    waterGroup.style.opacity = 0.0;
    const g = growthFactor();
    const params = presets[state.type];

    // set biom and health visuals
    state.biomass = Math.max(0.01, lerp(state.biomass, g * params.pmax, 0.02));
    biomEl.textContent = state.biomass.toFixed(2);
    const health = Math.round(g * 100);
    healthEl.textContent = `${health}%`;
    modeEl.textContent = 'growing';

    // color of branch depends on type
    const branchColor = state.type === 'succulent' ? '#5a8a5a' : '#6a4b2a';

    if(state.type === 'algae'){
      drawAlgae(params, g);
      // add subtle wave animation: use transform to shift group
      rootGroup.style.transition = 'transform 1.2s ease-in-out';
      const sway = Math.sin(state.time*0.006)*8;
      rootGroup.style.transform = `translate(${sway}px,0)`;
      return;
    }

    // general plant: trunk + recursive branches
    // trunk base
    const trunkLen = lerp(30, 140, g) * (state.type === 'tree' ? 1.6 : 1.0);
    const trunk = document.createElementNS('http://www.w3.org/2000/svg','path');
    const startX = 0, startY = 0;
    const endX = 0, endY = -trunkLen;
    // trunk path in local coordinates — will be transformed by rootGroup translate
    trunk.setAttribute('d', `M ${startX} ${startY} L ${endX} ${endY}`);
    trunk.setAttribute('stroke', '#6a4b2a');
    trunk.setAttribute('stroke-width', params.thickness * (0.9 + g*0.6));
    trunk.setAttribute('stroke-linecap','round');
    trunk.setAttribute('fill','none');
    rootGroup.appendChild(trunk);

    // draw recursive branches from top of trunk
    const topX = endX, topY = endY;
    // create multiple main branches
    const mainBranches = state.type === 'tree' ? 3 : 2;
    for(let i=0;i<mainBranches;i++){
      const baseAngle = (i - (mainBranches-1)/2) * (params.angle * 1.4);
      const len = trunkLen * (0.7 + (i*0.1));
      drawBranch(topX, topY, len, baseAngle, 0, params, g, branchColor);
    }

    // small leaves around trunk
    for(let i=0;i<6;i++){
      const rx = (Math.random()*2-1)*30;
      const ry = -Math.random()*trunkLen*(0.4 + Math.random()*0.6);
      const leaf = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      leaf.setAttribute('cx', rx);
      leaf.setAttribute('cy', ry);
      leaf.setAttribute('rx', params.leafSize * (0.6 + Math.random()*0.6));
      leaf.setAttribute('ry', params.leafSize * 0.35);
      leaf.setAttribute('transform', `rotate(${(Math.random()*60-30)} ${rx} ${ry})`);
      leaf.setAttribute('fill', state.type === 'succulent' ? 'url(#succGrad)' : 'url(#leafGrad)');
      leaf.setAttribute('opacity', 0.9);
      leaf.classList.add('leaf');
      rootGroup.appendChild(leaf);
    }
  }

  // update state from controls
  function readControls(){
    state.type = typeEl.value;
    state.light = +lightEl.value;
    state.temp = +tempEl.value;
    state.hum = +humEl.value;
  }

  function tick(time){
    state.time = time;
    readControls();
    // if algae, make water visible
    if(state.type === 'algae'){
      waterGroup.style.opacity = 1.0;
      // center root group lower so fronds grow into water
      rootGroup.setAttribute('transform','translate(400,460)');
    } else {
      waterGroup.style.opacity = 0.0;
      rootGroup.setAttribute('transform','translate(400,540)');
      rootGroup.style.transform = '';
    }

    // animate biomass slowly increasing when conditions good
    buildPlant();

    requestAnimationFrame(tick);
  }

  // bindings
  restartBtn.addEventListener('click', () => {
    state.biomass = 0.05;
    buildPlant();
  });

  // initial placement
  rootGroup.setAttribute('transform','translate(400,540)');
  // kick loop
  requestAnimationFrame(tick);

})();
