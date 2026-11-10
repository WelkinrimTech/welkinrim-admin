"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Product, SupabaseProduct, ProductCategory } from '@/lib/products';
import { getCategoryFromSeries } from '@/lib/products';
import { supabase } from '@/lib/supabaseClient';

interface ProductRow {
  id: string;
  category: string;
  series: string;
  model: string;
  data: Product;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  is_published: boolean;
}

const CATEGORY_VALUES: ProductCategory[] = ['motor', 'esc', 'fc', 'ips', 'other'];

// An explicit category chosen in the form wins; otherwise derive it from the series id.
function resolveCategory(product: { series: string; category?: ProductCategory }): ProductCategory {
  if (product.category && CATEGORY_VALUES.includes(product.category)) return product.category;
  return getCategoryFromSeries(product.series);
}

export function useProducts() {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProducts = useCallback(async () => {
    return supabase
      .from('products')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
  }, []);

  const applyProducts = useCallback(({ data, error }: Awaited<ReturnType<typeof fetchProducts>>) => {
    if (error) {
      console.error('Error loading products from Supabase', error);
      setProducts([]);
      setLoading(false);
      return;
    }

    // Map Supabase rows to SupabaseProduct format
    const mapped = (data as ProductRow[]).map(row => ({
      ...row.data,
      id: row.id,
      category: row.category as ProductCategory,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_published: row.is_published,
      is_deleted: row.is_deleted,
    }));

    setProducts(mapped);
    setLoading(false);
  }, []);

  // Reload with the loading flag raised (used after mutations and on refresh)
  const loadFromSupabase = useCallback(async () => {
    setLoading(true);
    applyProducts(await fetchProducts());
  }, [fetchProducts, applyProducts]);

  // Initial load: `loading` already starts true, so state is only set once the fetch resolves
  useEffect(() => {
    void fetchProducts().then(applyProducts);
  }, [fetchProducts, applyProducts]);

  const refresh = useCallback(() => {
    void loadFromSupabase();
  }, [loadFromSupabase]);

  const getAll = useMemo((): SupabaseProduct[] => {
    return products;
  }, [products]);

  const getById = useCallback((id: string): SupabaseProduct | undefined => {
    return products.find(p => p.id === id);
  }, [products]);

  const create = useCallback(async (product: Product, isDraft = false): Promise<boolean> => {
    const category = resolveCategory(product);

    const insertRow = (cat: string) => supabase.from('products').insert({
      id: product.id,
      category: cat,
      series: product.series,
      model: product.model,
      data: { ...product, category: cat },
      is_published: !isDraft, // Draft if isDraft=true, otherwise published
      is_deleted: false,
    });

    let { error } = await insertRow(category);
    // 23514 = check_violation: the DB only allows some category values; fall back to 'motor'
    if (error?.code === '23514' && category !== 'motor') {
      ({ error } = await insertRow('motor'));
    }

    if (error) {
      console.error('Error creating product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const update = useCallback(async (id: string, updates: Partial<Product>): Promise<boolean> => {
    const existing = products.find(p => p.id === id);
    if (!existing) return false;

    // Merge updates with existing data
    const merged = { ...existing, ...updates } as Product;
    const category = resolveCategory(merged);

    const updateRow = (cat: string) => supabase
      .from('products')
      .update({
        category: cat,
        series: merged.series,
        model: merged.model,
        data: { ...merged, category: cat },
      })
      .eq('id', id);

    let { error } = await updateRow(category);
    if (error?.code === '23514' && category !== 'motor') {
      ({ error } = await updateRow('motor'));
    }

    if (error) {
      console.error('Error updating product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [products, loadFromSupabase]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    // Soft delete: mark as deleted instead of removing
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const restore = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', id);

    if (error) {
      console.error('Error restoring product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const unpublish = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('products')
      .update({ is_published: false })
      .eq('id', id);

    if (error) {
      console.error('Error unpublishing product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  const publish = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('products')
      .update({ is_published: true })
      .eq('id', id);

    if (error) {
      console.error('Error publishing product', error);
      return false;
    }

    await loadFromSupabase();
    return true;
  }, [loadFromSupabase]);

  // Get products filtered by series/category
  const getBySeries = useCallback((series: string): SupabaseProduct[] => {
    if (series === 'all') return products;
    return products.filter(p => p.series === series);
  }, [products]);

  // Get drafts (unpublished products)
  const getDrafts = useCallback(async (): Promise<SupabaseProduct[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_published', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading drafts', error);
      return [];
    }

    return (data as ProductRow[]).map(row => ({
      ...row.data,
      id: row.id,
      category: row.category as ProductCategory,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_published: row.is_published,
      is_deleted: row.is_deleted,
    }));
  }, []);

  // Get deleted products (trash)
  const getDeleted = useCallback(async (): Promise<SupabaseProduct[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false });

    if (error) {
      console.error('Error loading deleted products', error);
      return [];
    }

    return (data as ProductRow[]).map(row => ({
      ...row.data,
      id: row.id,
      category: row.category as ProductCategory,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_published: row.is_published,
      is_deleted: row.is_deleted,
    }));
  }, []);

  return {
    products,
    loading,
    getAll,
    getById,
    create,
    update,
    remove,
    restore,
    unpublish,
    publish,
    getBySeries,
    getDrafts,
    getDeleted,
    refresh,
  };
}
