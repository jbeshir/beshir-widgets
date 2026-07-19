const AdmZip=require('adm-zip'); const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..'); const out=path.join(root,'src','assets'); fs.mkdirSync(out,{recursive:true});
const picks=[
 ['/in/assetsdb-data/sources/kenney-tiny-dungeon.zip','Tilemap/tilemap_packed.png','tiny-dungeon.png'],
 ['/in/assetsdb-data/sources/kenney-kenney-fonts.zip','Fonts/Kenney Pixel Square.ttf','kenney-pixel-square.ttf']
];
for(const [archive,member,name] of picks){const z=new AdmZip(archive);const entry=z.getEntry(member);if(!entry)throw new Error(`missing ${member}`);fs.writeFileSync(path.join(out,name),entry.getData());console.log(`${archive} :: ${member} -> ${name}`)}
