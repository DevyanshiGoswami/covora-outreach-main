import assert from 'node:assert/strict';
import test from 'node:test';
import {parseLinkedInSession,sessionConnectionFields} from '../src/lib/linkedin-session';
import {connectionOperation,connectionFailureMessage} from '../src/lib/onboarding';
const cookies=[{name:'li_at',value:'synthetic-session',domain:'.linkedin.com',path:'/'},{name:'JSESSIONID',value:'"ajax:synthetic"',domain:'.linkedin.com',path:'/'}];
test('browser export drops tracking cookies and extension metadata',()=>{
 const exported=[...cookies.map(c=>({...c,httpOnly:true,expirationDate:Date.now()/1000+3600})),{name:'tracking',value:'discard-me',domain:'.linkedin.com',path:'/'}];
 assert.deepEqual(parseLinkedInSession(JSON.stringify(exported)),cookies);
});
test('missing, malformed, expired, duplicate and off-domain session values fail without reflecting secrets',()=>{
 for(const input of ['synthetic-secret', 'x'.repeat(65537), JSON.stringify({cookies}),JSON.stringify([cookies[0]]),JSON.stringify([cookies[0],cookies[0]]),JSON.stringify([{...cookies[0],domain:'evil.test'},cookies[1]]),JSON.stringify([{...cookies[0],expirationDate:1},cookies[1]]),JSON.stringify([{...cookies[0],value:'x'.repeat(2049)},cookies[1]])]){
  assert.throws(()=>parseLinkedInSession(input),error=>error instanceof Error && !error.message.includes('synthetic-secret'));
 }
});
test('session fields normalize the public profile, include browser context and never include a password',()=>{
 const f=new FormData();f.set('cookies',JSON.stringify(cookies));f.set('profileUrl','https://linkedin.com/in/My-Profile/?trk=example');f.set('userAgent','Synthetic Chrome');f.set('password','discard-password');
 assert.deepEqual(sessionConnectionFields(f),{method:'cookies',cookies,profileUrl:'https://www.linkedin.com/in/my-profile',userAgent:'Synthetic Chrome'});
 for(const url of ['https://linkedin.com.evil.test/in/user','https://www.linkedin.com/company/user','http://linkedin.com/in/user']){f.set('profileUrl',url);assert.throws(()=>sessionConnectionFields(f));}
 f.set('profileUrl','https://linkedin.com/in/user');f.delete('userAgent');assert.throws(()=>sessionConnectionFields(f));
});
test('cookie operation is LinkedIn-only and provider failures use fixed neutral copy',()=>{
 assert.deepEqual(connectionOperation('start-cookies','linkedin'),{action:'start',method:'cookies'});
 assert.throws(()=>connectionOperation('start-cookies','email'));
 assert.match(connectionFailureMessage('linkedin_profile_mismatch')!,/different LinkedIn profile/);
 assert.match(connectionFailureMessage('linkedin_access_denied')!,/account-login API access/);
 assert.match(connectionFailureMessage('linkedin_no_free_seat')!,/no free sender seat/);
 assert.doesNotMatch(connectionFailureMessage('linkedin_no_free_seat')!,/account-login/);
 assert.match(connectionFailureMessage('linkedin_location_unavailable')!,/country/);
 assert.doesNotMatch(connectionFailureMessage('linkedin_location_unavailable')!,/fresh session|cookies/);
 assert.match(connectionFailureMessage('linkedin_request_rejected')!,/sign-in details and country/);
});
