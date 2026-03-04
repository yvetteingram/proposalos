import { createClient } from '@supabase/supabase-js';
import { Artifact, Client, Proposal, UserProfile } from '../types';

// ─── CLIENT ─────────────────────────────────────────────────
// Single Supabase client instance — reused across the app.
// Uses VITE_ prefixed env vars so Vite exposes them to the browser.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── AUTH ────────────────────────────────────────────────────
// Email/password only — no Google Auth, no Firebase Auth.

export const signUp = async (email: string, password: string) => {
  // Gate signup: check for active subscription from Gumroad webhook
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (profileError || !profile || profile.subscription_status !== 'active') {
    throw new Error('No active subscription found for this email. Please purchase on Gumroad first.');
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
};

// ─── USER PROFILE OPS ───────────────────────────────────────

export const fetchUser = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, plan, subscription_status, industry, avg_deal_size, has_completed_onboarding, system_profile, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('fetchUser error:', error.message);
    return null;
  }
  return data as UserProfile;
};

export const syncUser = async (userId: string, updates: Partial<UserProfile>) => {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`syncUser failed: ${error.message}`);
};

// ─── ARTIFACT OPS ───────────────────────────────────────────

export const saveArtifactToCloud = async (
  userId: string,
  artifact: Omit<Artifact, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Artifact> => {
  const { data, error } = await supabase
    .from('artifacts')
    .insert({ ...artifact, user_id: userId })
    .select('id, user_id, type, title, content, created_at, updated_at')
    .single();

  if (error) throw new Error(`saveArtifact failed: ${error.message}`);
  return data as Artifact;
};

export const deleteArtifact = async (artifactId: string) => {
  const { error } = await supabase
    .from('artifacts')
    .delete()
    .eq('id', artifactId);

  if (error) throw new Error(`deleteArtifact failed: ${error.message}`);
};

export const fetchArtifacts = async (userId: string): Promise<Artifact[]> => {
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, user_id, type, title, content, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchArtifacts failed: ${error.message}`);
  return (data ?? []) as Artifact[];
};

// ─── PROPOSAL OPS ───────────────────────────────────────────

export const saveProposalToCloud = async (
  userId: string,
  proposal: Omit<Proposal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Proposal> => {
  const { data, error } = await supabase
    .from('proposals')
    .insert({ ...proposal, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(`saveProposal failed: ${error.message}`);
  return data as Proposal;
};

export const updateProposalStatus = async (
  proposalId: string,
  status: Proposal['status']
) => {
  const updates: Record<string, string> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'sent') updates.sent_at = new Date().toISOString();
  if (status === 'won') updates.won_at = new Date().toISOString();

  const { error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', proposalId);

  if (error) throw new Error(`updateProposalStatus failed: ${error.message}`);
};

export const fetchProposals = async (userId: string): Promise<Proposal[]> => {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchProposals failed: ${error.message}`);
  return (data ?? []) as Proposal[];
};

// ─── CLIENT OPS ─────────────────────────────────────────────

export const saveClientToCloud = async (
  userId: string,
  client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Client> => {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...client, user_id: userId })
    .select('id, user_id, name, company, email, notes, learned_context, created_at, updated_at')
    .single();

  if (error) throw new Error(`saveClient failed: ${error.message}`);
  return data as Client;
};

export const deleteClient = async (clientId: string) => {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) throw new Error(`deleteClient failed: ${error.message}`);
};

export const fetchClients = async (userId: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('clients')
    .select('id, user_id, name, company, email, notes, learned_context, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchClients failed: ${error.message}`);
  return (data ?? []) as Client[];
};