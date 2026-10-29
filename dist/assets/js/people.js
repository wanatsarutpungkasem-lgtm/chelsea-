(() => {
 const filter=document.querySelector('#squad-filter');
 if(!filter)return;
 const cards=[...document.querySelectorAll('.squad-card')];
 filter.addEventListener('change',()=>{cards.forEach(c=>{c.hidden=filter.value!=='all'&&c.dataset.position!==filter.value;});document.querySelector('#squad-count').textContent='แสดง '+cards.filter(c=>!c.hidden).length+' คน';});
})();
