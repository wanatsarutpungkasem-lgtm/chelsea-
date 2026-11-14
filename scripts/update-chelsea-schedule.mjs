import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fetchClubSchedule,normalizeSchedule} from '../lib/chelsea-schedule.mjs';
const input=process.argv.indexOf('--input');
const schedule=input>=0?normalizeSchedule(JSON.parse(await readFile(process.argv[input+1],'utf8'))):await fetchClubSchedule();
if(!schedule.fixtures.length)throw new Error('No validated Premier League fixtures: keep the existing snapshot for review');
await mkdir('dist/data',{recursive:true});
await writeFile('dist/data/chelsea-next.json',JSON.stringify(schedule,null,2)+'\n');
console.log(`Updated ${schedule.fixtures.length} fixtures from Chelsea FC; ${schedule.fetchedAt}`);
