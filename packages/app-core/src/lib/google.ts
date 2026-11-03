/**
 * ID do cliente OAuth **web** do Google — público por natureza (vai no HTML de
 * qualquer app com login Google).
 *
 * O app nativo também usa este, e não o cliente Android: no Android o Google
 * reconhece o app pelo pacote + SHA-1 (cliente Android no Google Cloud), mas
 * emite o ID token para o cliente web — é ele que o Supabase confere.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "646199416785-18c092fk6l3fjs44a7pvea3gia7bmvjn.apps.googleusercontent.com";
