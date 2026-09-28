async function initArtifact(){
  try{
    if(window.claude && typeof window.claude.use === 'function'){
      claudeArtifact = await window.claude.use('artifact');
    }
  }catch(e){ claudeArtifact = null; }
}
async function loadInitialState(){
  try{
    const res = await fetch('data/db.json', {cache:'no-store'});
    if(res.ok){ return await res.json(); }
  }catch(e){}
  try{
    const raw = localStorage.getItem('ft_bar_cache_v1');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}
function setSaveIndicator(kind, text){
  const el = document.getElementById('save-indicator');
  const t = document.getElementById('save-indicator-text');
  el.className = 'state-' + kind;
  t.textContent = text;
}
function scheduleSave(){
  setSaveIndicator('pending','Enregistrement…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 1100);
}
async function doSave(){
  const json = JSON.stringify(state);
  try{ localStorage.setItem('ft_bar_cache_v1', json); }catch(e){}
  if(claudeArtifact){
    try{
      await claudeArtifact.publish({ 'data/db.json': json });
      setSaveIndicator('saved','Enregistré ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
      return;
    }catch(err){
      const code = err && err.code;
      if(code==='not_writer' || code==='not_granted' || code==='not_declared' || code==='capability_disabled'){
        setSaveIndicator('readonly','Sauvegarde locale (appareil)');
        return;
      }
      if(code==='conflict'){
        setSaveIndicator('error','Mise à jour ailleurs — rechargement…');
        setTimeout(()=>location.reload(), 1400);
        return;
      }
      setSaveIndicator('error','Non synchronisé — nouvel essai…');
      setTimeout(doSave, 4000);
      return;
    }
  } else {
    setSaveIndicator('readonly','Sauvegarde locale (appareil)');
  }
}