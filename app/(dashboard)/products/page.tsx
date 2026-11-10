'use client';

import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useSeries } from '@/hooks/useSeries';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductFilters } from '@/components/products/ProductFilters';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { ProductTableSkeleton } from '@/components/loading/SkeletonLoader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabaseClient';
import type { Product, SupabaseProduct } from '@/lib/products';
import { useToast } from '@/context/ToastContext';

type CategoryFilter = string; // 'all' or a series id
type SortKey = 'model' | 'series' | 'category' | 'weight';
type SortDir = 'asc' | 'desc';

export default function ProductsPage() {
  const { products, loading, remove, create, update, publish, unpublish, refresh } = useProducts();
  const { series: seriesList } = useSeries();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('model');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<SupabaseProduct | null>(null);
  const [viewingProduct, setViewingProduct] = useState<SupabaseProduct | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<SupabaseProduct | null>(null);
  const [duplicateProduct, setDuplicateProduct] = useState<SupabaseProduct | null>(null);

  // Bulk delete confirmation
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkTrashIds, setBulkTrashIds] = useState<string[]>([]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Series filter
    if (activeCategory !== 'all') {
      result = result.filter(p => p.series === activeCategory);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.model.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (p.name && p.name.toLowerCase().includes(query)) ||
        p.series.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortKey) {
        case 'model':
          aVal = (a.name || a.model).toLowerCase();
          bVal = (b.name || b.model).toLowerCase();
          break;
        case 'series':
          aVal = (a.seriesLabel || a.series).toLowerCase();
          bVal = (b.seriesLabel || b.series).toLowerCase();
          break;
        case 'category':
          aVal = (a.category || '').toLowerCase();
          bVal = (b.category || '').toLowerCase();
          break;
        case 'weight':
          // Extract weight from allSpecs
          const aWeight = a.allSpecs?.find(s => s.label.toLowerCase().includes('weight'))?.value || '0';
          const bWeight = b.allSpecs?.find(s => s.label.toLowerCase().includes('weight'))?.value || '0';
          aVal = parseInt(aWeight.match(/\d+/)?.[0] || '0');
          bVal = parseInt(bWeight.match(/\d+/)?.[0] || '0');
          break;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, activeCategory, sortKey, sortDir, searchQuery]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleEdit = (product: SupabaseProduct) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleView = (product: SupabaseProduct) => {
    setViewingProduct(product);
  };

  const handleDelete = async () => {
    if (!deleteConfirmProduct) return;
    const success = await remove(deleteConfirmProduct.id);
    if (success) {
      toast.success(`"${deleteConfirmProduct.name || deleteConfirmProduct.model}" moved to trash`);
    } else {
      toast.error('Failed to delete product');
    }
    setDeleteConfirmProduct(null);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  // Duplicate product
  const handleDuplicate = (product: SupabaseProduct) => {
    setDuplicateProduct(product);
  };

  const confirmDuplicate = async () => {
    if (!duplicateProduct) return;

    // Create copy with new ID
    const newId = `${duplicateProduct.series}-${crypto.randomUUID().slice(0, 8)}`;
    const newProduct: Product = {
      ...duplicateProduct,
      id: newId,
      model: `${duplicateProduct.model} (Copy)`,
      name: duplicateProduct.name ? `${duplicateProduct.name} (Copy)` : `${duplicateProduct.model} (Copy)`,
    };

    const success = await create(newProduct);
    if (success) {
      toast.success(`Product duplicated as "${newProduct.model}"`);
      setIsFormOpen(false);
      setDuplicateProduct(null);
    } else {
      toast.error('Failed to duplicate product');
    }
  };

  // Quick publish/unpublish
  const handlePublish = async (id: string) => {
    const success = await publish(id);
    if (success) {
      toast.success('Product published');
    } else {
      toast.error('Failed to publish product');
    }
  };

  const handleUnpublish = async (id: string) => {
    const success = await unpublish(id);
    if (success) {
      toast.success('Product unpublished (moved to drafts)');
    } else {
      toast.error('Failed to unpublish product');
    }
  };

  // Bulk actions
  const handleBulkPublish = async (ids: string[]) => {
    const results = await Promise.all(ids.map(id => publish(id)));
    const successCount = results.filter(r => r).length;
    toast.success(`${successCount} products published`);
  };

  const handleBulkUnpublish = async (ids: string[]) => {
    const results = await Promise.all(ids.map(id => unpublish(id)));
    const successCount = results.filter(r => r).length;
    toast.success(`${successCount} products unpublished`);
  };

  const handleBulkMoveToTrash = async (ids: string[]) => {
    const results = await Promise.all(ids.map(id => remove(id)));
    const successCount = results.filter(r => r).length;
    toast.success(`${successCount} products moved to trash`);
  };

  const handleBulkDelete = async (ids: string[]) => {
    // Hard delete - actually remove from database
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', ids);

    if (!error) {
      toast.success(`${ids.length} products permanently deleted`);
    } else {
      toast.error('Failed to delete products');
    }
  };

  // Filter tabs come from the live series table, plus any series ids used by products but not listed
  const filterTabs = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(p => counts.set(p.series, (counts.get(p.series) || 0) + 1));
    const tabs = seriesList.map(s => ({ id: s.id, label: s.label, count: counts.get(s.id) || 0 }));
    counts.forEach((count, id) => {
      if (!seriesList.some(s => s.id === id)) tabs.push({ id, label: id, count });
    });
    return tabs;
  }, [products, seriesList]);

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage motor catalogue and components</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => window.location.href = '/drafts'}>
            <DraftIcon />
            Drafts
          </button>
          <button className="btn btn-primary" onClick={handleAddNew}>
            <PlusIcon />
            Add Product
          </button>
        </div>
      </div>

      <ProductFilters
        activeCategory={activeCategory}
        onCategoryChange={(cat) => setActiveCategory(cat)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        tabs={filterTabs}
        total={products.length}
      />

      {loading ? (
        <ProductTableSkeleton />
      ) : (
        <ProductTable
          products={filteredProducts}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onEdit={handleEdit}
          onDelete={(id) => {
            const product = products.find(p => p.id === id);
            if (product) setDeleteConfirmProduct(product);
          }}
          onView={handleView}
          onDuplicate={handleDuplicate}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onBulkDelete={handleBulkDelete}
          onBulkPublish={handleBulkPublish}
          onBulkUnpublish={handleBulkUnpublish}
          onBulkMoveToTrash={handleBulkMoveToTrash}
        />
      )}

      {isFormOpen && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setIsFormOpen(false); refresh(); }}
        />
      )}

      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={() => handleEdit(viewingProduct)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmProduct}
        title="Move to Trash"
        message={`Are you sure you want to move "${deleteConfirmProduct?.name || deleteConfirmProduct?.model}" to trash? It can be restored from the Trash page.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmProduct(null)}
      />

      {/* Duplicate confirmation */}
      <ConfirmDialog
        isOpen={!!duplicateProduct}
        title="Duplicate Product"
        message={`Create a copy of "${duplicateProduct?.name || duplicateProduct?.model}"? The duplicate will be saved as a draft.`}
        confirmText="Duplicate"
        cancelText="Cancel"
        confirmType="primary"
        onConfirm={confirmDuplicate}
        onCancel={() => setDuplicateProduct(null)}
      />

      <style jsx>{`
        .products-page {
          padding: 24px;
          max-width: 1600px;
        }

        .products-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: 28px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin-bottom: 4px;
        }

        .page-subtitle {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-ink-mid);
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms ease;
          border: 1px solid transparent;
        }

        .btn-primary {
          background: var(--color-gold);
          border-color: var(--color-gold);
          color: var(--color-ink);
        }

        .btn-primary:hover {
          filter: brightness(1.1);
        }

        .btn-secondary {
          background: var(--color-white-pure);
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-secondary:hover {
          background: var(--color-white-grey);
        }
      `}</style>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3v12M3 9h12" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 3H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2z" />
      <path d="M11 6H7M11 9H7" />
    </svg>
  );
}