import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url))), qa=join(root,"artifacts/grant-deck/qa");
await mkdir(qa,{recursive:true});
const names=(await readdir(qa)).filter(n=>/^Slide\d+\.PNG$/i.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
if(names.length!==10) throw new Error(`Expected 10 PowerPoint PNG renders, found ${names.length}`);
const thumbW=640,thumbH=360,gap=28,label=34,cols=2,rows=5;
const composites=[];
for(let i=0;i<names.length;i++){const input=join(qa,names[i]);const png=await sharp(input).resize(thumbW,thumbH,{fit:"fill"}).png().toBuffer();const x=gap+(i%cols)*(thumbW+gap),y=gap+Math.floor(i/cols)*(thumbH+label+gap);composites.push({input:png,left:x,top:y});}
await sharp({create:{width:gap+cols*(thumbW+gap),height:gap+rows*(thumbH+label+gap),channels:4,background:"#171713"}}).composite(composites).png().toFile(join(qa,"Settle_Investor_Deck_Contact_Sheet.png"));
console.log("Wrote contact sheet");