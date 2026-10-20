(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storeKey = 'slatehouse-project-v1';
  const initialScenes = [
    {id:'02B',title:'Пристань просыпается',location:'Северный причал',kind:'EXT',light:'day',pages:1.375,plannedMinutes:80,cast:['Мара','Капитан'],note:'Первый луч скользит по воде. Туман держится до 08:10.',status:'ready'},
    {id:'07A',title:'Долгий переход',location:'Северный причал',kind:'EXT',light:'day',pages:2,plannedMinutes:110,cast:['Мара','Лев'],note:'Нужен флаг на ветру и мокрая палуба.',status:'ready'},
    {id:'11C',title:'Ключ от радиорубки',location:'Радиорубка',kind:'INT',light:'day',pages:1.25,plannedMinutes:75,cast:['Мара','Смотритель'],note:'Подготовить старый передатчик и дублирующий ключ.',status:'ready'},
    {id:'04D',title:'Список пассажиров',location:'Радиорубка',kind:'INT',light:'any',pages:1.5,plannedMinutes:65,cast:['Смотритель','Лев'],note:'Крупный план рукописной ведомости.',status:'ready'},
    {id:'13A',title:'Последний сигнал',location:'Маяк · нижний этаж',kind:'INT',light:'night',pages:1.75,plannedMinutes:95,cast:['Мара','Капитан','Смотритель'],note:'Свет только от аварийной лампы; проверить дым-машину.',status:'ready'},
    {id:'05B',title:'Не уходи один',location:'Маяк · нижний этаж',kind:'INT',light:'night',pages:1.125,plannedMinutes:80,cast:['Мара','Капитан'],note:'Тишина до последнего слова. План — длинный проход.',status:'ready'},
    {id:'09F',title:'Окно наверху',location:'Маяк · фонарь',kind:'EXT',light:'day',pages:1.5,plannedMinutes:70,cast:['Мара'],note:'Снимать до того, как солнце уйдёт за облака.',status:'ready'},
    {id:'14B',title:'Условие смотрителя',location:'Радиорубка',kind:'INT',light:'any',pages:1.25,plannedMinutes:55,cast:['Смотритель','Лев'],note:'Актёры на площадке одновременно: блокировать проход.',status:'ready'},
    {id:'03A',title:'Вода у порога',location:'Северный причал',kind:'EXT',light:'day',pages:0.625,plannedMinutes:50,cast:['Мара'],note:'Ведро с морской водой; непрерывность с 02B.',status:'ready'}
  ];
  const hasSavedProject = (() => { try { return Boolean(localStorage.getItem(storeKey)); } catch (_) { return false; } })();
  let project = loadProject();
  if (!hasSavedProject && !project.plan.length) project.plan = buildPlan(project.scenes);
  let selectedId = project.scenes[0]?.id || null;
  let activeFilter = 'all';
  let toastTimer = 0;

  function loadProject() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey));
      if (saved && Array.isArray(saved.scenes)) return saved;
    } catch (_) {}
    return {scenes: initialScenes.map(scene => ({...scene, cast:[...scene.cast]})), plan:[], sunset:'18:42'};
  }
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(project)); $('#saveState').innerHTML = '<i></i>СОХРАНЕНО ЛОКАЛЬНО'; }
    catch (_) { $('#saveState').innerHTML = '<i></i>ЭКСПОРТИРУЙТЕ РЕЗЕРВНУЮ КОПИЮ'; }
  }
  function idOrder(id) { return Number(String(id).match(/\d+/)?.[0] || 0); }
  function duration(scene) { return Math.max(15, Number(scene.plannedMinutes) || Math.round(scene.pages * (scene.kind === 'EXT' ? 34 : 28) + 18)); }
  function toMinutes(time) { const [h,m] = time.split(':').map(Number); return h*60+m; }
  function clock(minutes) { const h=Math.floor(minutes/60),m=minutes%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function castCallTimes() {
    const calls = new Map();
    const scheduled = project.plan.length ? project.plan : buildPlan(project.scenes);
    for (const item of scheduled) {
      const scene = project.scenes.find(entry=>entry.id===item.id); if (!scene) continue;
      for (const actor of scene.cast) calls.set(actor, Math.min(calls.get(actor) ?? Infinity, item.start - 30));
    }
    return calls;
  }
  function buildPlan(scenes) {
    const locationCounts = new Map();
    scenes.forEach(s=>locationCounts.set(s.location,(locationCounts.get(s.location)||0)+1));
    const locations=[...locationCounts.keys()].sort((a,b)=>locationCounts.get(b)-locationCounts.get(a));
    const rank = new Map(locations.map((location,index)=>[location,index]));
    const ordered=[...scenes].sort((a,b)=>{
      const lightRank=s=>s.kind==='EXT'&&s.light==='day'?0:s.light==='night'?2:1;
      return lightRank(a)-lightRank(b)||(rank.get(a.location)-rank.get(b.location))||idOrder(a.id)-idOrder(b.id);
    });
    let start=390;
    return ordered.map(scene=>{if(scene.light==='night')start=Math.max(start,19*60+30);const item={id:scene.id,start,duration:duration(scene)};start+=item.duration+12;return item;});
  }
  function autoPlan() {
    project.plan=buildPlan(project.scenes);
    selectedId=project.plan[0]?.id||null;
    render();
    showToast('Сцены сгруппированы по площадкам и свету. Проверьте красные пометки.');
  }
  function getIssues() {
    if (!project.plan.length) return ['Нажмите «Собрать день», чтобы проверить световые окна и переезды.'];
    const issues=[];let previousLocation='',moves=0;const sunset=toMinutes(project.sunset||'18:42');
    for (const item of project.plan) {
      const scene=project.scenes.find(s=>s.id===item.id);if(!scene)continue;
      if(previousLocation&&previousLocation!==scene.location)moves++;
      previousLocation=scene.location;
      if(scene.kind==='EXT'&&scene.light==='day'&&item.start+item.duration>sunset)issues.push(`${scene.id}: дневная натура тянется за закат.`);
      if(scene.light==='night'&&item.start<19*60+30)issues.push(`${scene.id}: ночной свет запланирован до наступления темноты.`);
      if(!scene.cast.length)issues.push(`${scene.id}: не указан состав актёров.`);
    }
    if(moves>2)issues.push(`За день ${moves} переездов между локациями — проверьте транспорт и время на сбор.`);
    const first=project.plan[0]?.start||390,last=project.plan.at(-1),wrap=last?last.start+last.duration:first;
    if(wrap-first>12*60)issues.push('Смена длиннее 12 часов. Перенесите сцену или разделите день.');
    if(!issues.length)issues.push('Критичных конфликтов не найдено. Уточните время на перестановку света.');
    return issues;
  }
  function visibleScenes() {
    const sequence=project.plan.length?project.plan:buildPlan(project.scenes);
    const ordered=sequence.map(p=>project.scenes.find(s=>s.id===p.id)).filter(Boolean);
    return ordered.filter(s=>activeFilter==='all'||(activeFilter==='night'?s.light==='night':s.light!=='night'));
  }
  function render() {
    const ordered=visibleScenes();
    $('#sceneList').innerHTML=ordered.map((scene,index)=>{
      const plan=(project.plan.length?project.plan:buildPlan(project.scenes)).find(item=>item.id===scene.id);const time=plan?clock(plan.start):'—';const isDay=scene.light==='day';
      return `<article class="scene-card ${selectedId===scene.id?'is-selected':''} ${scene.status==='shot'?'is-shot':''}" data-scene="${escapeHtml(scene.id)}" tabindex="0" aria-label="Сцена ${escapeHtml(scene.id)} ${escapeHtml(scene.title)}">
        <div class="scene-time"><b>${time}</b><small>${plan?`+${plan.duration} МИН`:'ПО ПЛАНУ'}</small></div>
        <div><div class="scene-title"><small>${escapeHtml(scene.id)}</small>${escapeHtml(scene.title)}</div><div class="scene-meta"><span>${escapeHtml(scene.kind)} · ${escapeHtml(scene.location)}</span><i>•</i><span>${scene.cast.length} акт.</span><i>•</i><span>${isDay?'ДЕНЬ':scene.light==='night'?'НОЧЬ':'ЛЮБОЙ СВЕТ'}</span></div></div>
        <div class="scene-side"><span class="scene-pages">${scene.pages.toLocaleString('ru-RU')} стр.</span><button class="take-button ${scene.status==='shot'?'is-shot':''}" data-take="${escapeHtml(scene.id)}" type="button">${scene.status==='shot'?'✓ СНЯТА':'ОТМЕТИТЬ'}</button></div>
      </article>`;
    }).join('')||'<div class="empty-state">В этом фильтре сцен пока нет. Добавьте сцену или выберите другой вид.</div>';
    $$('.scene-card').forEach(card=>{
      card.addEventListener('click',event=>{if(event.target.closest('[data-take]'))return;selectedId=card.dataset.scene;render();});
      card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectedId=card.dataset.scene;render();}});
    });
    $$('[data-take]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const scene=project.scenes.find(s=>s.id===button.dataset.take);scene.status=scene.status==='shot'?'ready':'shot';save();render();}));
    renderInspector();renderSummary();save();
  }
  function renderInspector() {
    const scene=project.scenes.find(s=>s.id===selectedId);if(!scene){$('#inspector').innerHTML='<p>Выберите сцену в плане.</p>';return;}
    const issues=getIssues();const plan=project.plan.find(item=>item.id===scene.id);
    $('#inspector').innerHTML=`<div class="inspector-kicker"><span>РАЗБОР СЦЕНЫ</span><span class="inspector-number">${escapeHtml(scene.id)}</span></div>
      <h3>${escapeHtml(scene.title)}</h3><div class="inspector-loc">${escapeHtml(scene.location)} / ${escapeHtml(scene.kind==='EXT'?'НАТУРА':'ПАВИЛЬОН')}</div>
      <div class="inspector-badges"><span class="badge ${scene.kind==='EXT'?'is-alert':''}">${escapeHtml(scene.kind==='EXT'?'НАТ. · EXT':'ИНТ. · INT')}</span><span class="badge">${escapeHtml(scene.light==='day'?'ДНЕВНОЙ СВЕТ':scene.light==='night'?'НОЧНОЙ СВЕТ':'ЛЮБОЕ ВРЕМЯ')}</span></div>
      <div class="inspector-grid"><div><small>ОБЪЁМ</small><b>${scene.pages.toLocaleString('ru-RU')} стр.</b></div><div><small>ВРЕМЯ В ПЛАНЕ</small><b>${plan?clock(plan.start):'Не собрано'}</b></div><div><small>СОСТАВ</small><b>${scene.cast.length} актёра</b></div><div><small>СТАТУС</small><b>${scene.status==='shot'?'Снята':'Готова к смене'}</b></div></div>
      <label class="duration-field">РАБОЧАЯ ОЦЕНКА СЪЁМКИ, МИНУТ<input id="sceneDuration" type="number" min="15" max="480" step="5" value="${duration(scene)}"><small>Задайте по опыту своей группы. Объём сценария сам по себе не предсказывает хронометраж.</small></label>
      <p class="inspector-note">${escapeHtml(scene.note||'Нет заметки. Добавьте деталь, которую группе важно проверить до дубля.')}</p>
      <div class="inspector-actions"><select id="sceneStatus" aria-label="Статус сцены"><option value="ready" ${scene.status==='ready'?'selected':''}>Готова</option><option value="shot" ${scene.status==='shot'?'selected':''}>Снята</option></select><button id="removeScene" type="button">Убрать сцену ×</button></div>
      <div class="issue-list"><h4>ПРОВЕРКА ДНЯ</h4>${issues.slice(0,4).map(issue=>`<p>${escapeHtml(issue)}</p>`).join('')}</div>`;
    $('#sceneStatus').addEventListener('change',event=>{scene.status=event.target.value;save();render();});
    $('#sceneDuration').addEventListener('change',event=>{const minutes=Number(event.target.value);if(!Number.isFinite(minutes)||minutes<15||minutes>480){event.target.value=duration(scene);return;}scene.plannedMinutes=minutes;project.plan=buildPlan(project.scenes);render();showToast('Оценка обновлена; расписание пересобрано.');});
    $('#removeScene').addEventListener('click',()=>{project.scenes=project.scenes.filter(s=>s.id!==scene.id);project.plan=project.plan.filter(p=>p.id!==scene.id);selectedId=project.scenes[0]?.id||null;render();showToast('Сцена убрана из рабочего плана.');});
  }
  function renderSummary() {
    const pageTotal=project.scenes.reduce((n,s)=>n+Number(s.pages||0),0);const actors=new Set(project.scenes.flatMap(s=>s.cast));
    $('#statScenes').textContent=String(project.scenes.length).padStart(2,'0');$('#navSceneCount').textContent=String(project.scenes.length).padStart(2,'0');$('#filterAllCount').textContent=String(project.scenes.length).padStart(2,'0');$('#statPages').textContent=pageTotal.toLocaleString('ru-RU',{maximumFractionDigits:3}).replace(/,?0+$/,'');$('#statCast').textContent=String(actors.size).padStart(2,'0');
    const sequence=project.plan.length?project.plan:buildPlan(project.scenes);let moves=0,lastLocation='';
    for(const item of sequence){const s=project.scenes.find(x=>x.id===item.id);if(s&&lastLocation&&s.location!==lastLocation)moves++;if(s)lastLocation=s.location;}
    $('#statMoves').textContent=String(moves).padStart(2,'0');const finalItem=sequence.at(-1);$('#wrapTime').textContent=finalItem?clock(finalItem.start+finalItem.duration):'—';$('#callTime').textContent=sequence[0]?clock(Math.max(360,sequence[0].start-45)):'—';
    const first=sequence[0]&&project.scenes.find(s=>s.id===sequence[0].id);$('#firstScene').textContent=first?`${first.id} · ${first.location}`:'Нет сцен';
    const calls=castCallTimes();$('#castCalls').innerHTML=[...calls.entries()].sort((a,b)=>a[1]-b[1]).map(([name,time])=>`<span class="cast-pill"><b>${clock(Math.max(360,time))}</b>${escapeHtml(name)}</span>`).join('');
  }
  function downloadCallSheet() {
    if(!project.plan.length)autoPlan();
    const rows=project.plan.map((item,index)=>{const s=project.scenes.find(x=>x.id===item.id);return `<tr><td>${index+1}</td><td>${clock(item.start)}</td><td>${escapeHtml(s.id)} · ${escapeHtml(s.title)}</td><td>${escapeHtml(s.location)}</td><td>${escapeHtml(s.kind)} / ${s.pages} стр.</td><td>${escapeHtml(s.cast.join(', '))}</td><td>${escapeHtml(s.note||'—')}</td></tr>`;}).join('');
    const calls=[...castCallTimes()].sort((a,b)=>a[1]-b[1]).map(([name,time])=>`<li>${clock(Math.max(360,time))} — ${escapeHtml(name)}</li>`).join('');
    const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Call sheet · Последний паром</title><style>body{font:12px Arial,sans-serif;color:#252b28;margin:28px}h1{font:28px Georgia,serif}small{color:#765d46}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #bbb3a5;padding:7px;text-align:left;vertical-align:top}th{background:#eee5d6;font-size:10px;text-transform:uppercase}.calls{display:flex;gap:15px;flex-wrap:wrap}li{margin:4px 0}@media print{body{margin:12mm}}</style><h1>ПОСЛЕДНИЙ ПАРОМ · СЪЁМОЧНЫЙ ДЕНЬ 02</h1><small>СБОР ГРУППЫ ${$('#callTime').textContent} · СЕВЕРНЫЙ БЕРЕГ · ПЛОЩАДКА 01</small><h2>План съёмок</h2><table><thead><tr><th>#</th><th>Начало</th><th>Сцена</th><th>Площадка</th><th>Объём</th><th>Актёры</th><th>Заметка</th></tr></thead><tbody>${rows}</tbody></table><h2>Призывы актёров</h2><ul class="calls">${calls}</ul><h2>Проверки до смены</h2><ul>${getIssues().map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul><p>Лист подготовлен в Slatehouse. Подтвердите время и адрес до отправки группе.</p></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='slatehouse-call-sheet-day-02.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Call sheet готов. Откройте файл и распечатайте для группы.');
  }
  function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function showToast(message) { const el=$('#toast');el.textContent=message;el.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-visible'),2800); }
  function addScene(form) {
    const data=new FormData(form),title=String(data.get('title')).trim(),location=String(data.get('location')).trim();
    if(!title||!location)return;
    let number=Math.max(0,...project.scenes.map(s=>idOrder(s.id)))+1;const id=String(number).padStart(2,'0');
    project.scenes.push({id,title,location,kind:data.get('kind'),light:data.get('light'),pages:Number(data.get('pages'))||1,plannedMinutes:Number(data.get('plannedMinutes'))||90,cast:String(data.get('cast')).split(',').map(s=>s.trim()).filter(Boolean),note:String(data.get('note')).trim(),status:'ready'});
    project.plan=[];selectedId=id;form.reset();$('#sceneDialog').close();render();showToast('Сцена добавлена. Пересоберите расписание, чтобы проверить день.');
  }
  function restoreProject(file) { const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.scenes)||!data.scenes.every(s=>s.id&&s.title&&s.location))throw new Error('bad');project={...data,plan:Array.isArray(data.plan)?data.plan:[]};selectedId=project.scenes[0]?.id||null;render();showToast('Рабочая копия восстановлена.');}catch(_){showToast('Файл не похож на резервную копию Slatehouse.');}};reader.readAsText(file); }
  function bind() {
    $('#autoPlan').addEventListener('click',autoPlan);$('#addScene').addEventListener('click',()=>$('#sceneDialog').showModal());$('#downloadSheet').addEventListener('click',downloadCallSheet);
    $$('.filter').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;$$('.filter').forEach(x=>x.classList.toggle('is-active',x===button));render();}));
    $$('[data-close]').forEach(button=>button.addEventListener('click',()=>$('#'+button.dataset.close).close()));
    $('#sceneForm').addEventListener('submit',event=>{event.preventDefault();addScene(event.currentTarget);});
    $('#backupButton').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='slatehouse-project-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Резервная копия проекта скачана.');});
    $('#restoreInput').addEventListener('change',event=>{restoreProject(event.target.files[0]);event.target.value='';});
    document.querySelector('.top-actions .icon-button').addEventListener('click',()=>$('#restoreInput').click());
  }
  bind();render();
})();
