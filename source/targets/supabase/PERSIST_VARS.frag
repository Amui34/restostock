const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
const CACHE_KEY = 'livre_de_prix_cache_v1';
let sbClient = null;
let lastSnapshot = {};
let sbReadOnly = false;
let sbIgnoreUntil = 0;
const BRAND_SUFFIX = '';
