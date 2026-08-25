const fs=require('fs'),path=require('path'),https=require('https');
const css=fs.readFileSync('build/gf.css','utf8');
const KEEP=new Set(['thai','latin']);
const blocks=css.split(/(?=\/\* [a-z-]+ \*\/)/).filter(Boolean);
const out=[],jobs=[];
for(const b of blocks){
  const sub=(b.match(/^\/\* ([a-z-]+) \*\//)||[])[1];
  if(!KEEP.has(sub))continue;
  const fam=(b.match(/font-family: '([^']+)'/)||[])[1];
  const wt=(b.match(/font-weight: (\d+)/)||[])[1];
  const url=(b.match(/url\((https:[^)]+)\)/)||[])[1];
  if(!fam||!url)continue;
  const slug=fam.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const file=`${slug}-${wt}-${sub}.woff2`;
  jobs.push({url,file});
  out.push(b.replace(/url\(https:[^)]+\)/,`url(../fonts/${file})`).replace(/^\/\* [a-z-]+ \*\/\n/,''));
}
fs.mkdirSync('build/fonts',{recursive:true});
const get=(url,dest)=>new Promise((res,rej)=>{
  https.get(url,{headers:{'User-Agent':'Mozilla/5.0'}},r=>{
    if(r.statusCode!==200)return rej(new Error(url+' -> '+r.statusCode));
    const f=fs.createWriteStream(dest);r.pipe(f);f.on('finish',()=>f.close(()=>res()));
  }).on('error',rej);
});
(async()=>{
  for(const j of jobs)await get(j.url,path.join('build/fonts',j.file));
  fs.writeFileSync('build/fonts.css',out.join('\n'));
  const tot=jobs.reduce((s,j)=>s+fs.statSync(path.join('build/fonts',j.file)).size,0);
  console.log(`downloaded ${jobs.length} files, ${(tot/1024).toFixed(0)} KB total`);
  jobs.forEach(j=>console.log('  '+j.file,(fs.statSync(path.join('build/fonts',j.file)).size/1024).toFixed(1)+'KB'));
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
