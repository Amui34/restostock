<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>RestoStock</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1a1714">
<!-- Installable sur l'écran d'accueil : l'appli obtient son icône et s'ouvre
     en plein écran, sans barre d'adresse. C'est ce qui la fait ressembler à
     une application pour l'équipe, sans passer par un magasin d'applications.
     « apple-mobile-web-app-capable » reste nécessaire : iOS ne lit pas encore
     le mode d'affichage du manifeste. -->
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="RestoStock">
<meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>