'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useProducts';
import type { SupabaseProduct } from '@/lib/products';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function DraftsPage() {
  const { getDrafts, publish, remove } = useProducts();
  const [drafts, setDrafts] = useState<SupabaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<SupabaseProduct | null>(null);
  const [viewingProduct, setViewingProduct] = useState<SupabaseProduct | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadDrafts = async () => {
    setLoading(true);
    const data = await getDrafts();
    setDrafts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only load
  }, []);

  const publishDraft = async (id: string) => {
    const success = await publish(id);
    if (success) {
      await loadDrafts();
    }
  };

  const deleteDraft = async () => {
    if (!showDeleteConfirm) return;
    const success = await remove(showDeleteConfirm);
    if (success) {
      await loadDrafts();
    }
    setShowDeleteConfirm(null);
  };

  return (
    <div className="drafts-page">
      <div className="drafts-header">
        <div>
          <h1 className="page-title">Drafts</h1>
          <p className="page-subtitle">Manage unpublished products</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading drafts...</div>
      ) : drafts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📝</div>
          <h3>No drafts yet</h3>
          <p>Products saved as drafts will appear here</p>
        </div>
      ) : (
        <div className="drafts-grid">
          {drafts.map(draft => (
            <div key={draft.id} className="draft-card">
              <div className="draft-badge">Draft</div>
              <div className="draft-content">
                <h3>{draft.name || draft.model}</h3>
                <p className="draft-meta">
                  {draft.seriesLabel || draft.series?.toUpperCase()} · {draft.tag}
                </p>
                {draft.keySpecs && draft.keySpecs.length > 0 && (
                  <div className="draft-specs">
                    {draft.keySpecs.slice(0, 3).map((spec, i) => (
                      <span key={i} className="spec-item">{spec.label}: {spec.value}</span>
                    ))}
                  </div>
                )}
                <p className="draft-date">
                  Last edited {draft.updated_at ? new Date(draft.updated_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="draft-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewingProduct(draft)}
                  title="View details"
                >
                  <ViewIcon />
                  View
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingProduct(draft);
                    setIsFormOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => publishDraft(draft.id)}
                >
                  Publish
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowDeleteConfirm(draft.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={() => {
            setEditingProduct(viewingProduct);
            setIsFormOpen(true);
          }}
        />
      )}

      {/* Product Form Modal */}
      {isFormOpen && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => {
            setIsFormOpen(false);
            loadDrafts();
          }}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        title="Delete Draft"
        message="Are you sure you want to delete this draft? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={deleteDraft}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      <style jsx>{`
        .drafts-page {
          padding: 24px;
          max-width: 1400px;
        }

        .drafts-header {
          margin-bottom: 32px;
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

        .drafts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .draft-card {
          position: relative;
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 20px;
          transition: all 150ms ease;
        }

        .draft-card:hover {
          border-color: var(--color-gold);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .draft-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 4px 10px;
          background: var(--color-warning);
          color: white;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-radius: 3px;
        }

        .draft-content h3 {
          font-family: var(--font-display);
          font-size: 18px;
          margin: 0 0 8px 0;
          padding-right: 60px;
        }

        .draft-meta {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
          margin: 0 0 4px 0;
        }

        .draft-date {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
          margin: 0 0 16px 0;
        }

        .draft-specs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .spec-item {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-mid);
          background: var(--color-white-grey);
          padding: 4px 8px;
          border-radius: 3px;
        }

        .draft-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .btn {
          padding: 10px 16px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms ease;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-ghost {
          background: transparent;
          border-color: var(--color-white-border);
          color: var(--color-ink-soft);
        }

        .btn-ghost:hover {
          background: var(--color-white-grey);
          color: var(--color-ink);
        }

        .btn-secondary {
          background: var(--color-white-pure);
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-secondary:hover {
          background: var(--color-white-grey);
        }

        .btn-primary {
          background: var(--color-gold);
          border-color: var(--color-gold);
          color: var(--color-ink);
        }

        .btn-primary:hover {
          filter: brightness(1.1);
        }

        .btn-danger {
          background: transparent;
          border-color: var(--color-error);
          color: var(--color-error);
        }

        .btn-danger:hover {
          background: var(--color-error);
          color: white;
        }

        .empty {
          text-align: center;
          padding: 80px 20px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty h3 {
          font-family: var(--font-display);
          font-size: 20px;
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
          font-family: var(--font-mono);
          color: var(--color-ink-soft);
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
