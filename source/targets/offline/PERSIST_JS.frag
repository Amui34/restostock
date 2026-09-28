function loadInitialState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
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
  saveTimer = setTimeout(doSave, 500);
}
function doSave(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveIndicator('saved','Enregistré ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){
    setSaveIndicator('error','Échec de l’enregistrement (stockage plein ?)');
  }
}
function exportBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `livre-de-prix-sauvegarde-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data || !Array.isArray(data.products) || !Array.isArray(data.recipes)){
        alert('Ce fichier ne ressemble pas à une sauvegarde valide de RestoStock.');
        return;
      }
      if(!confirm('Remplacer toutes les données actuelles par celles de ce fichier ?')) return;
      state = data;
      if(!state.settings) state.settings = { margin_alert_pct:35, tva_rate_default:0.20 };
      if(!state.meta) state.meta = {};
      doSave(); render();
      alert('Sauvegarde importée avec succès.');
    }catch(e){
      alert('Impossible de lire ce fichier : ' + e.message);
    }
  };
  reader.readAsText(file);
}