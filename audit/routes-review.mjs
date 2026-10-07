import { mkdirSync, writeFileSync } from 'node:fs';
import { browserSession } from './browser-session.mjs';
const b=await browserSession();
const out='audit/responsive-final/routes';
mkdirSync(out,{recursive:true});
const report=[];
try {
  for(const path of ['/about','/example-components','/hero-original','/404']) {
    for(const width of [1440,768,390,320]) {
      await b.load(width,true,path);
      await b.evaluate("window.scrollTo({top:0,behavior:'instant'})");
      await b.wait(250);
      const sections=await b.evaluate(`[...document.querySelectorAll('main section')].map((e,i)=>({i,top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight,title:e.querySelector('h1,h2,h3')?.textContent.trim()}))`);
      const metrics=await b.evaluate(`(() => {
        const clipped=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(['auto','scroll','hidden','clip'].includes(s.overflowX))return true;}return false;};
        const visible=e=>{for(let p=e;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;};
        return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('h1').length,overflow:[...document.querySelectorAll('h1,h2,h3,p,a,button,label,input,select,textarea')].filter(e=>visible(e)&&!clipped(e)).filter(e=>{const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.trim().slice(0,80)})),brokenImages:[...document.images].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src),missingAnchors:[...document.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1)))};
      })()`);
      for(const section of sections) {
        if(section.height<1)continue;
        await b.evaluate(`window.scrollTo({top:${section.top},behavior:'instant'})`);
        await b.wait(140);
        const screenshot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        writeFileSync(`${out}/${path.slice(1)}-${width}-${section.i}.png`,Buffer.from(screenshot.data,'base64'));
      }
      report.push({path,width,sections,metrics});
      console.log(JSON.stringify({path,width,sections:sections.length,...metrics}));
    }
  }
  writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
} finally {await b.close();}
