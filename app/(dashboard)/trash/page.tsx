'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useProducts } from '@/hooks/useProducts';
import { useSeries, type Series } from '@/hooks/useSeries';
import type { SupabaseProduct } from '@/lib/products';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function TrashPage() {
  const { getDeleted, restore, remove: removeProduct } = useProducts();
  const { getDeleted: getDeletedSeries, restore: restoreSeries, remove: removeSeries } = useSeries();

  const [deletedProducts, setDeletedProducts] = useState<SupabaseProduct[]>([]);
  const [deletedSeries, setDeletedSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'series'>('products');

  // View details modal
  const [viewingProduct, setViewingProduct] = useState<SupabaseProduct | null>(null);
  const [viewingSeries, setViewingSeries] = useState<Series | null>(null);

  // Confirm dialogs
  const [showDeleteProductConfirm, setShowDeleteProductConfirm] = useState<string | null>(null);
  const [showDeleteSeriesConfirm, setShowDeleteSeriesConfirm] = useState<string | null>(null);

  const loadDeleted = async () => {
    setLoading(true);
    const products = await getDeleted();
    const series = await getDeletedSeries();
    setDeletedProducts(products);
    setDeletedSeries(series);
    setLoading(false);
  };

  useEffect(() => {
    loadDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only load
  }, []);

  const handleRestoreProduct = async (id: string) => {
    const success = await restore(id);
    if (success) {
      await loadDeleted();
    }
  };

  const handleRestoreSeries = async (id: string) => {
    const success = await restoreSeries(id);
    if (success) {
      await loadDeleted();
    }
  };

  const permanentlyDeleteProduct = async () => {
    if (!showDeleteProductConfirm) return;
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', showDeleteProductConfirm);

    if (!error) {
      await loadDeleted();
    }
    setShowDeleteProductConfirm(null);
  };

  const permanentlyDeleteSeries = async () => {
    if (!showDeleteSeriesConfirm) return;
    const { error } = await supabase
      .from('series')
      .delete()
      .eq('id', showDeleteSeriesConfirm);

    if (!error) {
      await loadDeleted();
    }
    setShowDeleteSeriesConfirm(null);
  };

  return (
    <div className="trash-page">
      <div className="trash-header">
        <div>
          <h1 className="page-title">Trash</h1>
          <p className="page-subtitle">Restore or permanently delete items</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products ({deletedProducts.length})
        </button>
        <button
          className={`tab ${activeTab === 'series' ? 'active' : ''}`}
          onClick={() => setActiveTab('series')}
        >
          Series ({deletedSeries.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="trash-content">
          {activeTab === 'products' && (
            <div className="items-list">
              {deletedProducts.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🗑️</div>
                  <h3>No deleted products</h3>
                  <p>Products moved to trash will appear here</p>
                </div>
              ) : (
                deletedProducts.map(product => (
                  <div key={product.id} className="trash-item">
                    <div className="item-info">
                      <h3>{product.name || product.model}</h3>
                      <p className="item-meta">
                        {product.seriesLabel || product.series?.toUpperCase()} · {product.tag}
                      </p>
                      <p className="item-date">
                        Deleted {product.deleted_at ? new Date(product.deleted_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="item-actions">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setViewingProduct(product)}
                        title="View details"
                      >
                        <ViewIcon />
                        View
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleRestoreProduct(product.id)}
                      >
                        Restore
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => setShowDeleteProductConfirm(product.id)}
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'series' && (
            <div className="items-list">
              {deletedSeries.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🗑️</div>
                  <h3>No deleted series</h3>
                  <p>Series moved to trash will appear here</p>
                </div>
              ) : (
                deletedSeries.map(series => (
                  <div key={series.id} className="trash-item">
                    <div className="item-info">
                      <h3>{series.label}</h3>
                      <p className="item-meta">ID: {series.id}</p>
                      <p className="item-date">
                        Deleted {series.deleted_at ? new Date(series.deleted_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="item-actions">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setViewingSeries(series)}
                        title="View details"
                      >
                        <ViewIcon />
                        View
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleRestoreSeries(series.id)}
                      >
                        Restore
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => setShowDeleteSeriesConfirm(series.id)}
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Product Detail Modal */}
      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}

      {/* Series Detail Modal */}
      {viewingSeries && (
        <SeriesDetailModal
          series={viewingSeries}
          onClose={() => setViewingSeries(null)}
        />
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={!!showDeleteProductConfirm}
        title="Permanently Delete Product"
        message="This action CANNOT be undone. The product will be completely removed from the database."
        confirmText="Delete Forever"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping="DELETE"
        onConfirm={permanentlyDeleteProduct}
        onCancel={() => setShowDeleteProductConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!showDeleteSeriesConfirm}
        title="Permanently Delete Series"
        message="This action CANNOT be undone. The series will be completely removed from the database."
        confirmText="Delete Forever"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping="DELETE"
        onConfirm={permanentlyDeleteSeries}
        onCancel={() => setShowDeleteSeriesConfirm(null)}
      />

      <style jsx>{`
        .trash-page {
          padding: 24px;
          max-width: 1200px;
        }

        .trash-header {
          margin-bottom: 24px;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: 28px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .page-subtitle {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-ink-soft);
        }

        .tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--color-white-border);
          margin-bottom: 24px;
        }

        .tab {
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          color: var(--color-ink-soft);
          transition: all 150ms ease;
        }

        .tab:hover {
          color: var(--color-ink);
        }

        .tab.active {
          color: var(--color-gold);
          border-bottom-color: var(--color-gold);
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .trash-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 6px;
        }

        .item-info h3 {
          font-family: var(--font-display);
          font-size: 16px;
          margin: 0 0 4px 0;
        }

        .item-meta {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
          margin: 0 0 2px 0;
        }

        .item-date {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-mid);
          margin: 0;
        }

        .item-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 16px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-ghost {
          background: transparent;
          border: 1px solid var(--color-white-border);
          color: var(--color-ink-soft);
        }

        .btn-ghost:hover {
          background: var(--color-white-grey);
          color: var(--color-ink);
        }

        .btn-secondary {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-secondary:hover {
          background: var(--color-white-grey);
        }

        .btn-danger {
          background: var(--color-error);
          border: 1px solid var(--color-error);
          color: white;
        }

        .btn-danger:hover {
          filter: brightness(0.9);
        }

        .empty {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty h3 {
          font-family: var(--font-display);
          font-size: 18px;
          margin: 0 0 8px 0;
        }

        .empty p {
          font-family: var(--font-body);
          color: var(--color-ink-soft);
          margin: 0;
        }

        .loading {
          text-align: center;
          padding: 60px 20px;
          color: var(--color-ink-soft);
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}

function ViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

function SeriesDetailModal({ series, onClose }: { series: Series; onClose: () => void }) {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{series.label}</h2>
            <p className="modal-subtitle">{series.id}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Label</span>
              <span className="detail-value">{series.label}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Description</span>
              <span className="detail-value">{series.description || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Created</span>
              <span className="detail-value mono">{formatDate(series.created_at)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Updated</span>
              <span className="detail-value mono">{formatDate(series.updated_at)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Deleted</span>
              <span className="detail-value mono">{formatDate(series.deleted_at)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(14, 14, 15, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal {
            max-width: 500px;
            width: 100%;
            background: var(--color-white-pure);
            border-radius: 8px;
          }

          .modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding: 24px;
            border-bottom: 1px solid var(--color-white-border);
          }

          .modal-title {
            font-family: var(--font-display);
            font-size: 20px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin: 0;
          }

          .modal-subtitle {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--color-ink-soft);
            margin: 4px 0 0 0;
          }

          .modal-close {
            width: 32px;
            height: 32px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--color-ink-soft);
            font-size: 24px;
            border-radius: 4px;
          }

          .modal-close:hover {
            background: var(--color-white-grey);
          }

          .modal-body {
            padding: 24px;
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid var(--color-white-border);
          }

          .detail-grid {
            display: grid;
            gap: 16px;
          }

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .detail-label {
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--color-ink-soft);
          }

          .detail-value {
            font-size: 14px;
            color: var(--color-ink);
          }

          .detail-value.mono {
            font-family: var(--font-mono);
            font-size: 13px;
          }

          .btn {
            padding: 10px 20px;
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 600;
            border-radius: 4px;
            cursor: pointer;
            background: var(--color-white-pure);
            border: 1px solid var(--color-white-border);
          }

          .btn:hover {
            background: var(--color-white-grey);
          }
        `}</style>
      </div>
    </div>
  );
}