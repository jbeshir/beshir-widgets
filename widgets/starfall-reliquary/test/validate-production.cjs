const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const input=path.resolve(process.argv[2]||''),root=path.resolve(__dirname,'..'),reportPath=path.join(root,'artifacts/production-validation-report.json');
let report={pass:false,file:input,sha256:'',static:{pass:false,violations:[]},smoke:{pass:false,boot:false,coreInput:false,networkRequests:[],pageErrors:[],consoleErrors:[]},error:null};
const write=()=>{fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath+'.tmp',JSON.stringify(report,null,2));fs.renameSync(reportPath+'.tmp',reportPath)};
(async()=>{let browser;try{
 const html=fs.readFileSync(input,'utf8');
 const scanned=html.replaceAll('http://www.w3.org/1998/Math/MathML','').replaceAll('http://www.w3.org/1999/xhtml','').replaceAll('http://www.w3.org/2000/svg','');
 report.sha256=crypto.createHash('sha256').update(html).digest('hex');
 for(const [name,re] of [['instrumentation',/__game|game-ready|data-game-|GAME_TEST_BUILD/],['module script',/<script[^>]+type=["']module/],['external script',/<script[^>]+src=/],['external style',/<link[^>]+rel=["']stylesheet/],['network URL',/https?:\/\//]])if(re.test(scanned))report.static.violations.push(name);
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'scenarios.json'))),boots=schema.scenarios.filter(x=>x.kind==='boot'),cores=schema.scenarios.filter(x=>x.kind==='core');
 if(boots.length!==1||!cores.length)report.static.violations.push('scenario counts');
 if([...boots,...cores].some(x=>[...x.setup,...x.actions].some(y=>y.startsWith('call:'))))report.static.violations.push('hooked boot/core');
 report.static.pass=!report.static.violations.length;if(!report.static.pass)throw Error('static violations: '+report.static.violations.join(','));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--allow-file-access-from-files']});
 const ctx=await browser.newContext({viewport:{width:1000,height:760}});await ctx.setOffline(true);await ctx.route(/^https?:/,r=>{report.smoke.networkRequests.push(r.request().url());return r.abort()});
 const page=await ctx.newPage();page.on('console',m=>{if(m.type()==='error')report.smoke.consoleErrors.push(m.text())});page.on('pageerror',e=>report.smoke.pageErrors.push(e.message));
 await page.goto('file://'+input);await page.waitForSelector('#widget-ready',{state:'attached'});
 report.smoke.boot=await page.evaluate(()=>{const b=document.querySelector('[data-testid=start-button]'),c=document.querySelector('canvas'),r=c.getBoundingClientRect(),x=c.getContext('2d'),data=x.getImageData(Math.max(0,c.width/2-20),Math.max(0,c.height/2-20),40,40).data,colors=new Set;for(let i=0;i<data.length;i+=16)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);return document.documentElement.dataset.widgetState==='ready'&&!!b&&!b.disabled&&r.width>=300&&r.height>=300&&colors.size>2});
 if(!report.smoke.boot)throw Error('boot predicate failed');await page.click('[data-testid=start-button]');const before=await page.locator('[data-player-position]').textContent();await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');await page.waitForTimeout(100);const after=await page.locator('[data-player-position]').textContent();
 report.smoke.coreInput=before!==after&&(await page.locator('[data-testid=wave-label]').textContent()).includes('Wave 1')&&!(await page.locator('.lost').count());report.smoke.pass=report.smoke.boot&&report.smoke.coreInput&&!report.smoke.networkRequests.length&&!report.smoke.pageErrors.length&&!report.smoke.consoleErrors.length;report.pass=report.static.pass&&report.smoke.pass;if(!report.pass)throw Error('production smoke failed');console.log('production-validation-ok '+report.sha256)
}catch(e){report.error=String(e.stack||e);process.exitCode=1}finally{await browser?.close();write()}})();
