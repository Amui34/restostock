    <hr class="hairline">
    <div class="field">
      <label>Données de l’équipe</label>
      <div class="hint">Tout le monde voit les mêmes données, mises à jour en direct. Une sauvegarde de secours reste utile avant une grosse opération (inventaire, reprise de fiches).</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="btn" data-action="export-backup">⬇ Exporter une sauvegarde (.json)</button>
        <button type="button" class="btn btn-ghost" data-action="sign-out">Se déconnecter</button>
      </div>
    </div>
    <hr class="hairline">
    <div class="field">
      <div class="hint">Source d’import initial : ${esc(state.meta.source)} — importé le ${fmtDate(state.meta.imported_at)}.</div>
    </div>