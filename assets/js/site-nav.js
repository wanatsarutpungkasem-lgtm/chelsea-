(() => {
  const menu = document.querySelector('.menu-toggle');
  const links = document.querySelector('#site-links');
  const dropdown = document.querySelector('.dropdown-toggle');
  const panel = document.querySelector('#more-links');
  const closeDropdown = () => { if(panel) panel.hidden = true; dropdown?.setAttribute('aria-expanded','false'); };
  function closeMenu(){links?.classList.remove('is-open'); menu?.setAttribute('aria-expanded','false');closeDropdown();}
  menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));links?.classList.toggle('is-open',open);if(!open)closeDropdown();});
  dropdown?.addEventListener('click',()=>{const open=dropdown.getAttribute('aria-expanded')!=='true';dropdown.setAttribute('aria-expanded',String(open));if(panel)panel.hidden=!open;});
  document.addEventListener('click',e=>{if(!e.target.closest('.nav-dropdown'))closeDropdown();if(!e.target.closest('.nav') && links?.classList.contains('is-open'))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(dropdown?.getAttribute('aria-expanded')==='true'){closeDropdown();dropdown.focus();}else if(links?.classList.contains('is-open')){closeMenu();menu?.focus();}}});
  // Keep previously shared section links working after splitting the homepage.
  const legacy={about:'about.html',favorites:'favorites.html',gallery:'gallery.html',dream:'dream.html'};
  if(/\/(?:index\.html)?$/.test(location.pathname)&&legacy[location.hash.slice(1)]) location.replace(legacy[location.hash.slice(1)]);
  const filter=document.querySelector('#gallery-filter');
  const figures=[...document.querySelectorAll('.gallery-item')];
  const dialog=document.querySelector('.photo-dialog');
  if(!filter||!dialog)return;
  let selected=0;
  let opener=null;
  const visible=()=>figures.filter(f=>!f.hidden);
  const full=dialog.querySelector('.photo-full');
  const caption=dialog.querySelector('#photo-caption');
  function show(index){const items=visible();selected=(index+items.length)%items.length;const figure=items[selected];full.src=figure.querySelector('.gallery-open').dataset.image;full.alt=figure.querySelector('img').alt;caption.textContent=figure.querySelector('h3').textContent+' · '+(selected+1)+' / '+items.length;}
  filter.addEventListener('change',()=>{figures.forEach(f=>{f.hidden=filter.value!=='all'&&f.dataset.category!==filter.value;});document.querySelector('#gallery-count').textContent=visible().length+' ภาพ';});
  figures.forEach(figure=>figure.querySelector('.gallery-open')?.addEventListener('click',e=>{opener=e.currentTarget;show(visible().indexOf(figure));dialog.showModal();}));
  dialog.querySelector('.photo-close').addEventListener('click',()=>dialog.close());
  dialog.querySelector('.photo-prev').addEventListener('click',()=>show(selected-1));
  dialog.querySelector('.photo-next').addEventListener('click',()=>show(selected+1));
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();show(selected+1);}if(e.key==='ArrowLeft'){e.preventDefault();show(selected-1);}});
  dialog.addEventListener('close',()=>opener?.focus());
})();
