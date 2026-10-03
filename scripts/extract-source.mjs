import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Usage: node scripts/extract-source.mjs path/to/original.html');
const html=await readFile(source,'utf8');await mkdir('private/seed',{recursive:true});const manifest={};
for(const kind of ['ijr','regional','corporate']){
 const template=html.match(new RegExp(`<template[^>]+id=["']tpl-${kind}["'][^>]*>([\\s\\S]*?)</template>`,'i'))?.[1];
 if(!template)throw Error('Missing template '+kind);
 const start=template.match(/\b(?:const|let|var)\s+DATA\s*=\s*\[/);if(!start)throw Error('Missing DATA '+kind);
 const offset=start.index+start[0].lastIndexOf('[');let depth=0,quoted=false,escaped=false,end=offset;
 for(;end<template.length;end++){const c=template[end];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='[')depth++;else if(c===']'&&!--depth){end++;break;}}
 const scripts=[...template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];const js=scripts.find(s=>/\b(?:let|const|var)\s+DATA\s*=/.test(s[1]));if(!js)throw Error('Missing source script');await mkdir('private/reference',{recursive:true});const sanitized=template.slice(0,offset)+'[]'+template.slice(end);const reference=[...sanitized.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(s=>/\b(?:let|const|var)\s+DATA\s*=/.test(s[1]));await writeFile('private/reference/'+kind+'.js',reference[1]);
 const rows=JSON.parse(template.slice(offset,end));const json=JSON.stringify(rows);await writeFile('private/seed/'+kind+'.json',json);manifest[kind]={count:rows.length,sha256:createHash('sha256').update(json).digest('hex')};
}
await writeFile('private/seed/manifest.json',JSON.stringify(manifest,null,2));console.log(Object.fromEntries(Object.entries(manifest).map(([kind,value])=>[kind,value.count])));
