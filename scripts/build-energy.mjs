import {build} from 'esbuild';
import {mkdir,readdir,rename} from 'node:fs/promises';
const archive='/tmp/ohm-energy-build-'+Date.now();
await mkdir(archive,{recursive:true});
await mkdir('dist/assets/energy',{recursive:true});
for(const name of await readdir('dist/assets/energy')) await rename('dist/assets/energy/'+name,archive+'/'+name);

await build({entryPoints:['src/blue-energy/boot.js'],bundle:true,format:'esm',splitting:true,outdir:'dist/assets/energy',minify:true,target:['es2022'],define:{'process.env.NODE_ENV':'"production"'},legalComments:'linked',metafile:true}).then(async result=>{const {writeFile}=await import('node:fs/promises');await writeFile('docs/energy-build-meta.json',JSON.stringify(result.metafile,null,2));});
