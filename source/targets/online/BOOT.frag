async function boot(){
  await initArtifact();
  const loaded = await loadInitialState();
  state = loaded || clone(SEED);
  let needsSave = !loaded;
  if(loaded && (!state.meta || state.meta.seed_version !== SEED.meta.seed_version)){
    mergeSeedUpdate();
    needsSave = true;
  }
  migrateState();
  if(needsSave) scheduleSave();
  const start = hashToView();
  if(start){ ui.view = start.view; ui.id = start.id; }
  render();
  if(needsOnboarding()) showOnboarding(0);
}