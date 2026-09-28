async function boot(){
  if(!SUPABASE_URL || SUPABASE_URL.indexOf('__') === 0){
    document.getElementById('app').innerHTML =
      '<div class="card empty"><div class="big">⚙</div><h3>Application non configurée</h3>'
      + '<p>L’adresse de la base de données n’a pas été renseignée au moment de la construction du fichier.</p></div>';
    return;
  }
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await ensureSignedIn();

  let loaded = null;
  try{
    loaded = await loadInitialState();
  }catch(err){
    document.getElementById('app').innerHTML =
      '<div class="card empty"><div class="big">⚠</div><h3>Connexion impossible</h3>'
      + '<p>Impossible de joindre la base de données. Vérifiez la connexion internet, puis rechargez la page.</p></div>';
    setSaveIndicator('error','Hors ligne');
    return;
  }

  const firstRun = !loaded;
  state = loaded || clone(SEED);
  if(loaded && (!state.meta || state.meta.seed_version !== SEED.meta.seed_version)){
    mergeSeedUpdate();
  }
  migrateState();

  if(firstRun && !sbReadOnly){
    try{ await seedSupabase(state); }
    catch(err){ console.error(err); setSaveIndicator('error','Installation incomplète — rechargez la page'); }
  } else if(sbReadOnly){
    setSaveIndicator('readonly','Hors ligne — dernière copie de cet appareil');
  } else {
    setSaveIndicator('saved','À jour');
  }

  if(!sbReadOnly) watchRemoteChanges();

  const start = hashToView();
  if(start){ ui.view = start.view; ui.id = start.id; }
  render();
  if(needsOnboarding()) showOnboarding(0);
}