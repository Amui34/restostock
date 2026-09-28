    <hr class="hairline">
    <div class="field">
      <label>Sauvegarde des données</label>
      <div class="hint">Cette version fonctionne sans connexion : tout est stocké uniquement dans ce navigateur, sur cet appareil. Exportez régulièrement une sauvegarde, et importez-la sur un autre appareil pour transférer vos données.</div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button type="button" class="btn" data-action="export-backup">⬇ Exporter une sauvegarde (.json)</button>
        <button type="button" class="btn" data-action="trigger-import">⬆ Importer une sauvegarde</button>
        <input type="file" id="import-file-input" accept="application/json" style="display:none;">
      </div>
    </div>
    <hr class="hairline">
    <div class="field">
      <div class="hint">Source d’import initial : ${esc(state.meta.source)} — importé le ${fmtDate(state.meta.imported_at)}.</div>
    </div>