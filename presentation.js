const chapterLinks=[...document.querySelectorAll('.chapter-link')];
const chapterTargets=chapterLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
function setChapter(id){chapterLinks.forEach(a=>{const on=a.hash==='#'+id;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
const chapterObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)setChapter(entry.target.id)},{rootMargin:'-10% 0px -65% 0px',threshold:0});
chapterTargets.forEach(el=>chapterObserver.observe(el));chapterLinks.forEach(a=>a.addEventListener('click',()=>setChapter(a.hash.slice(1))));
const chapterToggle=document.querySelector('#chapter-toggle');
chapterToggle.addEventListener('click',()=>{const open=chapterToggle.getAttribute('aria-expanded')!=='true';chapterToggle.setAttribute('aria-expanded',String(open));document.querySelector('#sidebar').classList.toggle('nav-open',open)});
chapterLinks.forEach(a=>a.addEventListener('click',()=>{chapterToggle.setAttribute('aria-expanded','false');document.querySelector('#sidebar').classList.remove('nav-open')}));
