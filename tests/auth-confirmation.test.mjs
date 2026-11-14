import {test} from 'node:test';import assert from 'node:assert/strict';
import {createConfirmationResender} from '../dist/assets/js/auth-confirmation.mjs';
test('confirmation resend validates email, excludes passwords and throttles retries',async()=>{
 let calls=[],time=0;const service=createConfirmationResender({send:async args=>{calls.push(args);return {error:null}},now:()=>time});
 await assert.rejects(service.resend('bad','https://site.test/dashboard.html'));assert.equal(calls.length,0);
 await service.resend(' test@example.com ','https://site.test/dashboard.html');
 assert.deepEqual(calls[0],{type:'signup',email:'test@example.com',options:{emailRedirectTo:'https://site.test/dashboard.html'}});
 await assert.rejects(service.resend('test@example.com','https://site.test/dashboard.html'));assert.equal(calls.length,1);
 time=60000;await service.resend('test@example.com','https://site.test/dashboard.html');assert.equal(calls.length,2);
});
test('provider errors propagate and retain cooldown without claiming success',async()=>{const service=createConfirmationResender({send:async()=>({error:Error('rate limit')}),now:()=>0});await assert.rejects(service.resend('test@example.com','https://site.test'),/rate limit/);assert.equal(service.remaining(),60)});
