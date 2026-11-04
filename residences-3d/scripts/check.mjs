import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=new URL('../dist/',import.meta.url);
for(const name of await readdir(dir))if(name.endsWith('.js')){
 const file=new URL(name,dir),r=spawnSync(process.execPath,['--check',fileURLToPath(file)],{encoding:'utf8'});
 if(r.status)throw Error(r.stderr);
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)/g))await access(new URL(match[1].split('?')[0],file));
}
console.log('All application modules pass syntax and local import checks.');
