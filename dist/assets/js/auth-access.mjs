// Classify a server decision; this never grants permissions in the browser.
export function ownerAccessResult(result){
 if(!result?.error)return result?.data===true?'owner':'reader';
 const error=result.error;
 if(error.code==='42501'&&/not the approved site owner|confirmed email account|sign in before claiming/i.test(error.message||''))return 'reader';
 return 'unavailable';
}
