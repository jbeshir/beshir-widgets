import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
export default defineConfig(({command})=>{
  const out=process.env.GAME_TEST_BUILD==='1'?'dist-test':'dist';
  return {base:'./',plugins:[preact(),viteSingleFile(),{
    name:'classic-output',
    closeBundle(){
      if(command!=='build')return;
      const p=resolve(__dirname,out,'index.html'),html=readFileSync(p,'utf8');
      const match=html.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/);
      if(!match)throw new Error('single-file script not found');
      const classic=match[0].replace(/<script type="module"/,'<script');
      writeFileSync(p,html.replace(match[0],'').replace('</body>',`${classic}</body>`));
    }
  }],resolve:{alias:{'./testSurface':resolve(__dirname,process.env.GAME_TEST_BUILD==='1'?'src/testSurface.test.ts':'src/testSurface.prod.ts')}},build:{outDir:out,assetsInlineLimit:100000000,cssCodeSplit:false}};
});
