(() => {
  "use strict";

  const STORAGE_KEY = "asc.v1";
  const SCHEMA_VERSION = 1;

  const pad = n => String(n).padStart(2, "0");
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromKey = s => {
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y, m-1, d);
  };
  const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
  const monday = d => addDays(d, -((d.getDay()+6)%7));
  const mondayKey = d => dateKey(monday(d));
  const compareKeys = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const uid = () => "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  const initialGoals = [
    ["🏋️","Sport",4],
    ["🇬🇧","Anglais",5],
    ["💼","Business",6],
    ["📚","Lecture",4],
    ["🌍","Culture / monde",3],
    ["🧰","Compétence pro",5],
    ["🧭","Fiche Ascension",7],
  ];

  function initialState(){
    const today = dateKey(new Date());
    const wk = mondayKey(new Date());
    return {
      schemaVersion: SCHEMA_VERSION,
      goals: initialGoals.map(([emoji,name,perWeek],i)=>({
        id: uid(), emoji, name, order:i, createdOn:today, archivedOn:null,
        targets:[{from:wk, perWeek}]
      })),
      checks:{},
      lastBackup:null
    };
  }

  function migrate(raw){
    if(!raw || typeof raw !== "object") return initialState();
    if(!raw.schemaVersion) raw.schemaVersion = 1;
    if(raw.schemaVersion !== 1) throw new Error("Version de données non prise en charge.");
    raw.goals = Array.isArray(raw.goals) ? raw.goals : [];
    raw.checks = raw.checks && typeof raw.checks === "object" ? raw.checks : {};
    raw.lastBackup = raw.lastBackup || null;
    return raw;
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrate(JSON.parse(raw)) : initialState();
    }catch(err){
      console.error(err);
      return initialState();
    }
  }

  let state = load();
  let selectedWeek = monday(new Date());

  function save(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(err){
      alert("Impossible d'enregistrer les données sur cet appareil.");
      console.error(err);
    }
  }

  function persistStorage(){
    try{
      if(navigator.storage && navigator.storage.persist){
        navigator.storage.persist().catch(()=>{});
      }
    }catch(_){}
  }

  function checksFor(key){
    return Array.isArray(state.checks[key]) ? state.checks[key] : [];
  }
  function isChecked(key, goalId){
    return checksFor(key).includes(goalId);
  }
  function toggleCheck(key, goalId){
    const set = new Set(checksFor(key));
    set.has(goalId) ? set.delete(goalId) : set.add(goalId);
    state.checks[key] = [...set];
    if(state.checks[key].length === 0) delete state.checks[key];
    save();
    renderAll();
  }

  function targetForWeek(goal, weekMondayKey){
    const targets = [...(goal.targets||[])].sort((a,b)=>compareKeys(a.from,b.from));
    let chosen = null;
    for(const t of targets){
      if(compareKeys(t.from, weekMondayKey) <= 0) chosen = t;
    }
    return chosen ? Math.max(1, Math.min(7, Number(chosen.perWeek)||1)) : null;
  }

  function goalActiveInWeek(goal, weekStart){
    const startKey = dateKey(weekStart);
    const endKey = dateKey(addDays(weekStart,6));
    if(compareKeys(goal.createdOn, endKey) > 0) return false;
    if(goal.archivedOn && compareKeys(goal.archivedOn, startKey) <= 0) return false;
    return targetForWeek(goal, startKey) !== null;
  }

  function goalActiveToday(goal){
    const today = dateKey(new Date());
    return goalActiveOnDate(goal, today);
  }

  function goalActiveOnDate(goal, key){
    return compareKeys(goal.createdOn,key) <= 0 &&
      (!goal.archivedOn || compareKeys(goal.archivedOn,key) > 0);
  }

  function weekDays(weekStart){
    return Array.from({length:7},(_,i)=>addDays(weekStart,i));
  }

  function countGoalInWeek(goalId, weekStart){
    return weekDays(weekStart).reduce((n,d)=>n+(isChecked(dateKey(d),goalId)?1:0),0);
  }

  function weekStats(weekStart){
    const wk = dateKey(weekStart);
    const goals = state.goals
      .filter(g=>goalActiveInWeek(g,weekStart))
      .sort((a,b)=>(a.order??0)-(b.order??0));
    let done=0, target=0;
    for(const g of goals){
      const t = targetForWeek(g,wk);
      const c = countGoalInWeek(g.id,weekStart);
      done += Math.min(c,t);
      target += t;
    }
    return {goals,done,target,score:target?Math.round(done/target*100):0};
  }

  function setTarget(goal, perWeek){
    const wk = mondayKey(new Date());
    perWeek = Math.max(1,Math.min(7,Math.round(Number(perWeek)||1)));
    goal.targets = Array.isArray(goal.targets) ? goal.targets : [];
    const existing = goal.targets.find(t=>t.from===wk);
    if(existing) existing.perWeek = perWeek;
    else goal.targets.push({from:wk, perWeek});
    goal.targets.sort((a,b)=>compareKeys(a.from,b.from));
  }

  function hasHistory(goalId){
    return Object.values(state.checks).some(arr=>Array.isArray(arr)&&arr.includes(goalId));
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s); }

  function renderHeader(){
    const now = new Date();
    document.getElementById("dateLabel").textContent =
      now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    const current = weekStats(monday(now));
    document.getElementById("headerScore").textContent = `Semaine ${current.score}%`;
  }

  function renderToday(){
    const today = dateKey(new Date());
    const currentWeek = monday(new Date());
    const goals = state.goals
      .filter(goalActiveToday)
      .sort((a,b)=>(a.order??0)-(b.order??0));
    const list = document.getElementById("taskList");
    list.innerHTML = "";

    let done = 0;
    for(const g of goals){
      const checked = isChecked(today,g.id);
      if(checked) done++;
      const target = targetForWeek(g,dateKey(currentWeek)) || 1;
      const count = countGoalInWeek(g.id,currentWeek);
      const label = document.createElement("label");
      label.className = "task" + (checked ? " done" : "");
      label.innerHTML = `
        <input type="checkbox" ${checked?"checked":""} aria-label="${escapeAttr(g.name)}">
        <span class="check" aria-hidden="true">${checked?"✓":""}</span>
        <span class="task-name">${escapeHtml(g.emoji)} ${escapeHtml(g.name)}</span>
        <span class="task-week">${count}/${target}</span>
      `;
      label.querySelector("input").addEventListener("change",()=>toggleCheck(today,g.id));
      list.appendChild(label);
    }
    if(goals.length===0) list.innerHTML = '<div class="empty">Aucun objectif actif.</div>';
    document.getElementById("todayCount").textContent = `${done} validé${done>1?"s":""}`;
  }

  function renderWeek(){
    const today = new Date();
    const start = selectedWeek;
    const stats = weekStats(start);
    const startLabel = start.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
    const end = addDays(start,6);
    const endLabel = end.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
    document.getElementById("weekRange").textContent = `${startLabel} – ${endLabel}`;
    document.getElementById("weekScore").textContent = `${stats.score}%`;
    document.getElementById("weekFill").style.width = `${stats.score}%`;
    document.getElementById("doneKpi").textContent = stats.done;
    document.getElementById("goalKpi").textContent = stats.target;

    const next = addDays(start,7);
    document.getElementById("nextWeek").disabled =
      compareKeys(dateKey(next), dateKey(monday(today))) > 0;

    const list = document.getElementById("weekList");
    list.innerHTML = "";
    const days = weekDays(start);
    const todayKey = dateKey(today);
    const wkKey = dateKey(start);

    for(const g of stats.goals){
      const target = targetForWeek(g,wkKey);
      const count = countGoalInWeek(g.id,start);
      const item = document.createElement("div");
      item.className = "weekitem";
      item.innerHTML = `
        <div class="weekrow">
          <div class="weekname">${escapeHtml(g.emoji)} ${escapeHtml(g.name)}</div>
          <div class="weektotal">${count}/${target}</div>
        </div>
        <div class="days"></div>
      `;
      const daysBox = item.querySelector(".days");
      days.forEach(d=>{
        const key = dateKey(d);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "day" + (isChecked(key,g.id)?" on":"");
        b.textContent = d.toLocaleDateString("fr-FR",{weekday:"narrow"});
        b.disabled = compareKeys(key,todayKey) > 0 || !goalActiveOnDate(g,key);
        b.setAttribute("aria-label",`${g.name} ${key}`);
        if(!b.disabled) b.addEventListener("click",()=>toggleCheck(key,g.id));
        daysBox.appendChild(b);
      });
      list.appendChild(item);
    }
    if(stats.goals.length===0) list.innerHTML='<div class="empty">Aucun objectif pour cette semaine.</div>';
  }

  function renderSettings(){
    const box = document.getElementById("settingsList");
    box.innerHTML = "";
    const goals=[...state.goals].sort((a,b)=>(a.order??0)-(b.order??0));
    const currentWk = mondayKey(new Date());

    goals.forEach(g=>{
      const target = targetForWeek(g,currentWk) || 1;
      const archived = !!g.archivedOn;
      const el = document.createElement("div");
      el.className = "setting" + (archived?" archived":"");
      el.innerHTML = `
        <div class="fields">
          <input class="field emoji" type="text" maxlength="4" value="${escapeAttr(g.emoji||"•")}" aria-label="Emoji">
          <input class="field name" type="text" value="${escapeAttr(g.name)}" aria-label="Nom">
          <input class="field num" type="number" min="1" max="7" value="${target}" aria-label="Fréquence par semaine" ${archived?"disabled":""}>
        </div>
        <div class="setting-actions">
          <span class="status">${archived ? "Archivé le "+g.archivedOn : "Actif"}</span>
          <button class="btn ${archived?"danger":""}" type="button">${archived ? "Supprimer données" : (hasHistory(g.id)?"Archiver":"Supprimer")}</button>
        </div>
      `;

      const emojiInput = el.querySelector(".emoji");
      const nameInput = el.querySelector(".name");
      const numInput = el.querySelector(".num");
      const action = el.querySelector("button");

      emojiInput.addEventListener("change",()=>{
        const v=emojiInput.value.trim();
        g.emoji=v||"•"; save(); renderAll();
      });
      nameInput.addEventListener("change",()=>{
        const v=nameInput.value.trim();
        if(v) g.name=v; else nameInput.value=g.name;
        save(); renderAll();
      });
      if(!archived){
        numInput.addEventListener("change",()=>{
          setTarget(g,numInput.value); save(); renderAll();
        });
      }

      action.addEventListener("click",()=>{
        if(archived){
          if(confirm(`Supprimer définitivement « ${g.name} » et tout son historique ?`)){
            state.goals=state.goals.filter(x=>x.id!==g.id);
            for(const k of Object.keys(state.checks)){
              state.checks[k]=state.checks[k].filter(id=>id!==g.id);
              if(state.checks[k].length===0) delete state.checks[k];
            }
            save();renderAll();
          }
          return;
        }
        if(hasHistory(g.id)){
          if(confirm(`Archiver « ${g.name} » ? Son historique sera conservé.`)){
            g.archivedOn=dateKey(new Date()); save(); renderAll();
          }
        }else{
          if(confirm(`Supprimer « ${g.name} » ?`)){
            state.goals=state.goals.filter(x=>x.id!==g.id); save(); renderAll();
          }
        }
      });
      box.appendChild(el);
    });
  }

  function renderBackup(){
    const el=document.getElementById("backupInfo");
    if(!state.lastBackup){ el.textContent="Dernière sauvegarde : jamais"; return; }
    const days=Math.max(0,Math.floor((Date.now()-new Date(state.lastBackup).getTime())/86400000));
    el.textContent = days===0 ? "Dernière sauvegarde : aujourd’hui" :
      `Dernière sauvegarde : il y a ${days} jour${days>1?"s":""}`;
  }

  function renderAll(){
    renderHeader();
    renderToday();
    renderWeek();
    renderSettings();
    renderBackup();
  }

  function addGoal(){
    const today=dateKey(new Date());
    const g={
      id:uid(),emoji:"✨",name:"Nouvel objectif",order:state.goals.length,
      createdOn:today,archivedOn:null,
      targets:[{from:mondayKey(new Date()),perWeek:3}]
    };
    state.goals.push(g);save();renderAll();
    const names=document.querySelectorAll(".setting .name");
    const last=names[names.length-1];
    if(last){last.focus();last.select();}
  }

  async function exportBackup(){
    const payload=JSON.stringify(state,null,2);
    const file=new File([payload],`ascension-backup-${dateKey(new Date())}.json`,{type:"application/json"});
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Sauvegarde Ascension"});
      }else{
        const url=URL.createObjectURL(file);
        const a=document.createElement("a");
        a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
      state.lastBackup=new Date().toISOString();
      save();renderBackup();
    }catch(err){
      if(err && err.name!=="AbortError") alert("La sauvegarde n’a pas pu être exportée.");
    }
  }

  function importBackup(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const incoming=migrate(JSON.parse(String(reader.result||"")));
        if(!Array.isArray(incoming.goals) || !incoming.checks) throw new Error();
        if(confirm("Remplacer les données actuelles par cette sauvegarde ?")){
          state=incoming;save();selectedWeek=monday(new Date());renderAll();
        }
      }catch(_){
        alert("Fichier de sauvegarde invalide.");
      }
    };
    reader.readAsText(file);
  }

  function bind(){
    document.querySelectorAll(".bottom button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".bottom button").forEach(x=>x.classList.remove("active"));
        document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("view"+btn.dataset.view).classList.add("active");
      });
    });

    document.getElementById("prevWeek").addEventListener("click",()=>{
      selectedWeek=addDays(selectedWeek,-7);renderWeek();
    });
    document.getElementById("nextWeek").addEventListener("click",()=>{
      const candidate=addDays(selectedWeek,7);
      if(compareKeys(dateKey(candidate),dateKey(monday(new Date())))<=0){
        selectedWeek=candidate;renderWeek();
      }
    });
    document.getElementById("addGoal").addEventListener("click",addGoal);
    document.getElementById("exportBtn").addEventListener("click",exportBackup);
    document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
    document.getElementById("importFile").addEventListener("change",e=>{
      const f=e.target.files && e.target.files[0];
      if(f) importBackup(f);
      e.target.value="";
    });
  }

  bind();
  persistStorage();
  renderAll();

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }
})();