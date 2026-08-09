(() => {
  'use strict';
  const cycle=10.2, narrative=6.7, rest=3.1, reset=.4;
  const beats=[[0,'00','QUIET REGISTER'],[.7,'01','ORDER'],[1.6,'02','INTENT'],[3.25,'03','ESCROW'],[4.65,'04','HOLD'],[5.35,'05','PROGRAM'],[6.05,'06','ALIGN'],[6.7,'07','REGISTER'],[9.8,'08','EDITORIAL RESET']];
  const root=document.body, plate=document.querySelector('.capture-plate'), desktop=document.querySelector('#desktop'), mobile=document.querySelector('#mobile'), readout=document.querySelector('.readout');
  let t=0, playing=false, raf=0, last=0, isMobile=new URLSearchParams(location.search).get('plate')==='mobile';
  const $=s=>document.querySelectorAll(s);
  function ease(x){return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2}
  function setOpacity(selector,value){$(selector).forEach(el=>el.style.opacity=value)}
  function draw(time){
    t=Math.max(0,Math.min(cycle,time)); const intro=ease(Math.min(1,t/.9));
    setOpacity('.order',t<.35?0:intro*.82); setOpacity('.intent',t<1.25?0:Math.min(1,(t-1.25)/.7)*.8);
    const ingress=Math.min(1,Math.max(0,(t-2.05)/.72)); setOpacity('.entry',ingress);
    const hold=t>=4.65&&t<5.35; setOpacity('.value',t<2.7?0:t<4.65?Math.min(1,(t-2.7)/.6):1); setOpacity('.value-glow',hold?1:0);
    const program=t<5.05?0:Math.min(1,(t-5.05)/.65); setOpacity('.program-plane',program);setOpacity('.rule-ticks',program);setOpacity('.rule-spine',program);
    const distribute=t<5.65?0:Math.min(1,(t-5.65)/.85);setOpacity('.rail',distribute);setOpacity('.terminal',distribute);setOpacity('.terminal-glow',t>=6.45&&t<7.0?Math.min(1,(t-6.45)/.25):0);
    const finality=t<6.35?0:Math.min(1,(t-6.35)/.35);setOpacity('.alignment',finality);setOpacity('.alignment-tick',finality);setOpacity('.final text',finality);
    const recede=t<9.8?1:1-(t-9.8)/reset; const resetMix=t<9.8?0:Math.max(0,1-recede); setOpacity('.value-glow',hold?1:0); setOpacity('.mechanism',t<9.8?1:1-resetMix*.72); setOpacity('.field,.mobile-field',1+resetMix*.15);
    const drift=t>=6.7&&t<9.8?Math.sin(t*.55)*2:0; $('.field,.mobile-field').forEach(el=>el.style.transform=`translateX(${drift}px)`);
    const beat=beats.reduce((a,b)=>t>=b[0]?b:a,beats[0]); readout.textContent=`${beat[1]} · ${beat[2]} · ${t.toFixed(2)}s / ${cycle.toFixed(2)}s`;
  }
  function frame(now){if(!playing)return; if(!last)last=now; t+=(now-last)/1000;last=now;if(t>=cycle){t=0;last=now}draw(t);raf=requestAnimationFrame(frame)}
  function play(replay=false){if(replay)t=0;playing=true;last=0;root.classList.add('stage-play');cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}
  function pause(){playing=false;cancelAnimationFrame(raf);draw(t)}
  function poster(){pause();draw(6.95)}
  function capture(){root.classList.toggle('capture')}
  function setPlate(mobileMode){isMobile=mobileMode;desktop.style.display=isMobile?'none':'';mobile.style.display=isMobile?'block':'none'}
  function switchPlate(){setPlate(!isMobile)}
  document.querySelector('[data-action=play]').onclick=()=>play(true);document.querySelector('[data-action=pause]').onclick=()=>playing?pause():play();document.querySelector('[data-action=poster]').onclick=poster;document.querySelector('[data-action=plate]').onclick=switchPlate;document.querySelector('[data-action=capture]').onclick=capture;document.querySelector('[data-action=safe]').onclick=()=>plate.classList.toggle('safe-zone');
  const params=new URLSearchParams(location.search);if(params.get('capture')==='1')root.classList.add('capture');if(params.get('poster')==='1')poster();else{draw(0);play(true)}
  setPlate(isMobile);
  window.renderAt=draw; window.pauseCinematic=pause;
})();