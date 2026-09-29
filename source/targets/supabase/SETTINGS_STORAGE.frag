    <hr class="hairline">
    <div class="field">
      <label>Données de l’équipe</label>
      <div class="hint">Tout le monde voit les mêmes données, mises à jour en direct. Une sauvegarde de secours reste utile avant une grosse opération (inventaire, reprise de fiches).</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
        <button type="button" class="btn" data-action="export-backup">${ico('download')} Exporter une sauvegarde (.json)</button>
        ${canEditSettings() ? `<button type="button" class="btn" data-action="import-backup">${ico('upload')} Importer une sauvegarde (.json)</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="sign-out">Se déconnecter</button>
      </div>
      ${canEditSettings() ? `<div class="hint" style="margin-top:6px;">L’import remplace tout le contenu de l’espace. Pratique pour reprendre un catalogue existant ou essayer l’outil avec un jeu de données complet.</div>` : ''}
    </div>
    ${state.meta && state.meta.source ? `<hr class="hairline">
    <div class="field">
      <div class="hint">Source d’import initial : ${esc(state.meta.source)}${state.meta.imported_at ? ` — importé le ${fmtDate(state.meta.imported_at)}` : ''}.</div>
    </div>` : ''}
