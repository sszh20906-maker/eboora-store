import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../functions/_lib/settings.js';
const base={productName:'Workout',headline:'Workout at home',description:'A complete guide',email:'owner@example.com',price:249};
for(const theme of ['aggressive','luxury','soft','tech']){
 const {errors,config}=validateConfig({...base,theme,accentColor:'#ee3344'});
 assert.deepEqual(errors,[]);assert.equal(config.theme,theme);assert.equal(config.accentColor,'#ee3344');
}
assert.equal(validateConfig({...base,theme:'bad',accentColor:'red;evil'}).config.accentColor,'');
const css=readFileSync(new URL('../public/assets/eboora-v31.css',import.meta.url),'utf8');
assert.match(css,/prefers-color-scheme:dark/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/aspect-ratio:16\/9/);
const admin=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
for(const id of ['themePreview','accentColor','useAccent'])assert.ok(admin.includes(`id="${id}"`));
console.log('v31 theme validation and asset checks passed');
