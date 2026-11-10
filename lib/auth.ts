/**
 * Supabase-backed authentication utilities
 *
 * We keep the same AuthContext API but delegate login to Supabase
 * using email/password. A lightweight user object is cached in
 * localStorage so AuthContext can restore session synchronously.
 */

import { supabase } from './supabaseClient';

export interface User {
  id: string;
  username: string; // email
  name: string;
  role: 'admin' | 'editor';
  is_super_admin: boolean;
  avatar?: string;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const auth = {
  async login(username: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error || !data.user) {
      return null;
    }

    const user = await this.buildUser(data.user.id, data.user.email ?? username, data.user.user_metadata);
    if (user) {
      this.saveSession(user);
    }
    return user;
  },

  async buildUser(id: string, email: string, metadata?: Record<string, string | undefined>): Promise<User | null> {
    // Fetch user profile to get is_super_admin status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_super_admin, role, full_name, avatar_url')
      .eq('id', id)
      .single();

    // Create profile if doesn't exist
    if (!profile) {
      const newProfile = {
        id,
        email,
        full_name: metadata?.full_name || email,
        role: 'admin',
        is_super_admin: false,
      };
      await supabase.from('user_profiles').insert(newProfile);
    }

    // Update last_login timestamp
    await supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id);

    return {
      id,
      username: email,
      name: profile?.full_name ?? metadata?.full_name ?? email,
      role: (profile?.role ?? 'admin') as 'admin' | 'editor',
      is_super_admin: profile?.is_super_admin ?? false,
      avatar: profile?.avatar_url ?? metadata?.avatar_url,
    };
  },

  async refreshSession(): Promise<User | null> {
    const session = this.getSession();
    if (!session) return null;

    // Get current auth user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      this.logout();
      return null;
    }

    // Refresh profile data
    const user = await this.buildUser(authUser.id, authUser.email ?? session.username, authUser.user_metadata);
    if (user) {
      this.saveSession(user);
    }
    return user;
  },

  saveSession(user: User): void {
    if (typeof window === 'undefined') return;
    try {
      const session = {
        user,
        expiresAt: Date.now() + SESSION_DURATION,
      };
      localStorage.setItem('welkinrim-admin-session', JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session', error);
    }
  },

  getSession(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const sessionStr = localStorage.getItem('welkinrim-admin-session');
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      if (session.expiresAt < Date.now()) {
        this.logout();
        return null;
      }
      return session.user;
    } catch (error) {
      console.error('Error getting session', error);
      return null;
    }
  },

  logout(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('welkinrim-admin-session');
    } catch (error) {
      console.error('Error clearing session', error);
    }
  },

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  },
};
