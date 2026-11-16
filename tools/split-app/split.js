// Split one big ES module into several, without editing a single function.
//
// It parses the file, assigns every top-level statement to a module (by the
// markers in a config file), works out from scope analysis which names each
// module needs from the others, and writes the modules with their imports and
// exports. Comments travel with the statement they sit above.
//
// It refuses to run if a module would assign to another module's `let` (an
// import is read-only) — move that value onto a shared object first. It lists
// every "eager" cross-module reference: a top-level const that needs another
// module's const while loading. Those must point at a module that imports
// nothing from the page modules, or the app throws at boot.
//
// Needs acorn and eslint-scope, installed OUTSIDE the repo. See PORTING.md.
const fs=require('fs'), acorn=require('acorn'), es=require('eslint-scope'), path=require('path');
const [,, inFile, outDir, configFile, dry] = process.argv;
if (!configFile) { console.error('usage: node split.js <app.js> <out dir> <config.js> [dry]'); process.exit(2); }
const src=fs.readFileSync(inFile,'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true,ranges:true});
const sm=es.analyze(ast,{ecmaVersion:2022,sourceType:'module'});
const mod=sm.globalScope.childScopes[0];
const stmts=ast.body;
const idx=(pos)=>{let lo=0,hi=stmts.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(pos<stmts[m].range[0])hi=m-1;else if(pos>=stmts[m].range[1])lo=m+1;else return m;}return -1;};

// ---- config: which statement starts which module. See xerra.config.js.
const { RANGES, OVERRIDE = {}, HEAD = {} } = require(path.resolve(configFile));

// ---- assign statements to modules
const first=(s)=>src.slice(s.range[0],s.range[1]);
const names=stmts.map(()=>[]); const home={};
for(const v of mod.variables) for(const d of v.defs){ const i=idx(d.name.range[0]); if(i>=0){names[i].push(v.name);home[v.name]=i;} }
const isImport=(s)=>s.type==='ImportDeclaration';
const owner=new Array(stmts.length).fill(null);
let cur=null; const seen=new Set();
stmts.forEach((s,i)=>{
  if(isImport(s)) return;
  for(const [marker,m] of RANGES){
    if(seen.has(marker)) continue;
    const hit = marker[0]==='@' ? first(s).startsWith(marker.slice(1)) : names[i].includes(marker);
    if(hit){ cur=m; seen.add(marker); break; }
  }
  owner[i]=cur;
  for(const n of names[i]) if(OVERRIDE[n]) owner[i]=OVERRIDE[n];
});
for(const [marker] of RANGES) if(!seen.has(marker)) throw new Error('marker not found: '+marker);

// ---- references
const ext={}; // imported name -> source
for(const s of stmts) if(isImport(s)) for(const sp of s.specifiers) ext[sp.local.name]=s.source.value;
const uses={}; const eager=[]; const exported=new Set(); const extUse={};
const lazy=(scope)=>{ for(let sc=scope; sc && sc!==mod; sc=sc.upper) if(sc.type==='function') return true; return false; };
for(const v of mod.variables){
  for(const r of v.references){
    const i=idx(r.identifier.range[0]); if(i<0||isImport(stmts[i])) continue;
    const m=owner[i];
    if(ext[v.name]){ ((extUse[m]??={})[ext[v.name]]??=new Set()).add(v.name); continue; }
    const hm=owner[home[v.name]];
    if(hm===m) continue;
    ((uses[m]??={})[hm]??=new Set()).add(v.name); exported.add(v.name);
    if(r.isWrite()) throw new Error(`cross-module write to ${v.name} in ${m}`);
    if(!lazy(r.from)) eager.push(`${m} needs ${hm}.${v.name} at load (line ${stmts[i].loc.start.line})`);
  }
}
// ---- emit
const mods=[...new Set(owner.filter(Boolean))];
const report=[];
for(const m of mods){
  let out=`// ${HEAD[m]||m}\n\n`;
  const extSrcs=Object.keys(extUse[m]||{});
  const order=['./store.js','./stories.js','./epub.js','./audio.js','./speech.js','./card-assistant.js','./version.js','./print-pdf.js'];
  extSrcs.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const wrap=(list,from)=>{ const one=`import { ${list.join(', ')} } from "${from}";\n`; if(one.length<=110) return one;
    let lines=[], line='  '; for(const n of list){ if((line+n+', ').length>106){lines.push(line.trimEnd()); line='  ';} line+=n+', '; } lines.push(line.trimEnd());
    return `import {\n${lines.join('\n')}\n} from "${from}";\n`; };
  for(const e of extSrcs) out+=wrap([...extUse[m][e]],e);
  const sib=Object.keys(uses[m]||{}).sort((a,b)=>(a==='core'?-1:b==='core'?1:a.localeCompare(b)));
  for(const h of sib) out+=wrap([...uses[m][h]].sort(),`./${h}.js`);
  let prevEnd=null, body='';
  stmts.forEach((s,i)=>{
    if(owner[i]!==m) return;
    // leading text: from the end of the previous statement (any module) to this one
    const before = i===0?0:stmts[i-1].range[1];
    let lead=src.slice(before,s.range[0]).replace(/^[ \t]*\n/,'');
    let text=src.slice(s.range[0],s.range[1]);
    if(names[i].some(n=>exported.has(n))) text='export '+text;
    const adjacent = i>0 && owner[i-1]===m && !isImport(stmts[i-1]);
    if(adjacent) body = body.replace(/\n$/,'') + src.slice(before,s.range[0]) + text + '\n';
    else body+= (body? '\n':'') + lead.replace(/^\n+/,'') + text + '\n';
  });
  out+='\n'+body;
  report.push(`${m}.js\t${out.split('\n').length} lines`);
  if(!dry) fs.writeFileSync(path.join(outDir,m+'.js'),out);
}
console.log(report.join('\n')); console.log('\nEAGER cross-module:\n'+(eager.join('\n')||'none'));
