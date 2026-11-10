"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface Enquiry {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  industry: string | null;
  message: string;
  product_id: string | null;
  product_model: string | null;
  status: 'new' | 'read' | 'responded' | 'resolved' | 'spam';
  notes: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export function useEnquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    read: 0,
    responded: 0,
    resolved: 0,
    spam: 0,
  });

  const fetchEnquiries = useCallback(async () => {
    return supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });
  }, []);

  const applyEnquiries = useCallback(({ data, error }: Awaited<ReturnType<typeof fetchEnquiries>>) => {
    if (error) {
      console.error('Error loading enquiries from Supabase', error);
      setEnquiries([]);
      setLoading(false);
      return;
    }

    const enquiriesData = data as Enquiry[];
    setEnquiries(enquiriesData);

    // Calculate stats
    setStats({
      total: enquiriesData.length,
      new: enquiriesData.filter(e => e.status === 'new').length,
      read: enquiriesData.filter(e => e.status === 'read').length,
      responded: enquiriesData.filter(e => e.status === 'responded').length,
      resolved: enquiriesData.filter(e => e.status === 'resolved').length,
      spam: enquiriesData.filter(e => e.status === 'spam').length,
    });

    setLoading(false);
  }, []);

  // Reload with the loading flag raised (used after mutations and on refresh)
  const loadFromSupabase = useCallback(async () => {
    setLoading(true);
    applyEnquiries(await fetchEnquiries());
  }, [fetchEnquiries, applyEnquiries]);

  // Initial load: `loading` already starts true, so state is only set once the fetch resolves
  useEffect(() => {
    void fetchEnquiries().then(applyEnquiries);
  }, [fetchEnquiries, applyEnquiries]);

  const refresh = useCallback(() => {
    void loadFromSupabase();
  }, [loadFromSupabase]);

  const updateStatus = useCallback(async (id: string, status: Enquiry['status']): Promise<boolean> => {
    const updateData: Partial<Enquiry> = { status };

    if (status === 'responded') {
      updateData.responded_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('enquiries')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating enquiry status', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const addNote = useCallback(async (id: string, notes: string): Promise<boolean> => {
    const { error } = await supabase
      .from('enquiries')
      .update({ notes })
      .eq('id', id);

    if (error) {
      console.error('Error adding note to enquiry', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const deleteEnquiry = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('enquiries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting enquiry', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const getById = useCallback((id: string): Enquiry | undefined => {
    return enquiries.find(e => e.id === id);
  }, [enquiries]);

  const getByStatus = useCallback((status: Enquiry['status']): Enquiry[] => {
    return enquiries.filter(e => e.status === status);
  }, [enquiries]);

  return {
    enquiries,
    loading,
    stats,
    refresh,
    updateStatus,
    addNote,
    deleteEnquiry,
    getById,
    getByStatus,
  };
}