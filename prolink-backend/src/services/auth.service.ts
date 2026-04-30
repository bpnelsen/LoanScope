import { supabase, supabaseAnon } from '../config/supabase';
import { Profile, Contractor } from '../types';

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  business_name: string;
  business_type?: 'sole_proprietor' | 'llc' | 'corporation' | 'partnership';
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResult {
  user: Profile;
  contractor: Contractor;
  session: AuthSession;
}

export interface LoginResult {
  user: Profile;
  contractor: Contractor | null;
  session: AuthSession;
}

export const authService = {
  /**
   * Registers a new contractor. Creates auth user, profile, and contractor record,
   * then signs in to return a live session.
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });

    if (createError || !authData.user) {
      throw new Error(createError?.message ?? 'Failed to create auth user');
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: input.email,
        full_name: input.full_name,
        phone: input.phone ?? null,
        role: 'contractor',
      })
      .select()
      .single();

    if (profileError || !profile) {
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(profileError?.message ?? 'Failed to create profile');
    }

    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .insert({
        profile_id: userId,
        business_name: input.business_name,
        business_type: input.business_type ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (contractorError || !contractor) {
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(contractorError?.message ?? 'Failed to create contractor');
    }

    const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (signInError || !sessionData.session) {
      throw new Error('Registration succeeded but auto-login failed. Please log in manually.');
    }

    return {
      user: profile as Profile,
      contractor: contractor as Contractor,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in ?? 3600,
        token_type: 'Bearer',
      },
    };
  },

  /**
   * Authenticates a contractor with email/password and returns a session.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      throw new Error('Invalid email or password');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const { data: contractor } = await supabase
      .from('contractors')
      .select('*')
      .eq('profile_id', data.user.id)
      .single();

    return {
      user: profile as Profile,
      contractor: contractor as Contractor | null,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in ?? 3600,
        token_type: 'Bearer',
      },
    };
  },

  /**
   * Refreshes an expired access token using a refresh token.
   */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      throw new Error('Invalid or expired refresh token');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      token_type: 'Bearer',
    };
  },

  /**
   * Returns the full profile + contractor record for the authenticated user.
   */
  async me(userId: string): Promise<{ profile: Profile; contractor: Contractor | null }> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error('Profile not found');
    }

    const { data: contractor } = await supabase
      .from('contractors')
      .select('*')
      .eq('profile_id', userId)
      .single();

    return { profile: profile as Profile, contractor: (contractor as Contractor) ?? null };
  },
};
