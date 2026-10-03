const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
const CACHE_PREFIX = 'restostock_cache_';
let sbClient = null;
let sbCompany = null;
let sbUser = null;
let sbMembers = null;      // null = l'équipe n'a pas encore été chargée
let lastSnapshot = {};
let sbReadOnly = false;
let sbIgnoreUntil = 0;
const BRAND_SUFFIX = '';
