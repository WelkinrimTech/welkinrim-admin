'use client';

import { useState } from 'react';
import { useSeries } from '@/hooks/useSeries';
import { useProducts } from '@/hooks/useProducts';
import type { Series } from '@/hooks/useSeries';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { uploadSeriesIcon } from '@/lib/imageUpload';

export default function SeriesPage() {
  const { series, loading, create, update, remove, softDelete } = useSeries();
  const { products } = useProducts();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [viewingSeries, setViewingSeries] = useState<Series | null>(null);
  const [formData, setFormData] = useState<Partial<Series>>({
    id: '',
    label: '',
    use_svg_logo: false,
    logo_src: '',
    accent: '#E8A800',
    text_on_accent: '#0e0e0f',
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Confirm dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Series | null>(null);
  const [showTrashConfirm, setShowTrashConfirm] = useState<Series | null>(null);

  // Calculate product count per series
  const getProductCount = (seriesId: string) => {
    return products.filter(p => p.series === seriesId).length;
  };

  const [uploadingIcon, setUploadingIcon] = useState(false);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!formData.id) {
      toast.error('Enter a Series ID before uploading an icon');
      return;
    }
    setUploadingIcon(true);
    const result = await uploadSeriesIcon(file, formData.id);
    setUploadingIcon(false);
    if (result.success && result.url) {
      setFormData(prev => ({ ...prev, icon_url: result.url }));
      toast.success('Icon uploaded');
    } else {
      toast.error(result.error || 'Icon upload failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const success = editingSeries
        ? await update(editingSeries.id, formData)
        : await create(formData as Series);

      if (success) {
        toast.success(editingSeries ? 'Series updated' : 'Series created');
        setIsFormOpen(false);
        setEditingSeries(null);
        setFormData({
          id: '',
          label: '',
          use_svg_logo: false,
          logo_src: '',
          accent: '#E8A800',
          text_on_accent: '#0e0e0f',
          description: '',
        });
      } else {
        toast.error('Failed to save series');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (s: Series) => {
    setEditingSeries(s);
    setFormData(s);
    setIsFormOpen(true);
  };

  const handleMoveToTrash = async () => {
    if (!showTrashConfirm) return;
    const success = await softDelete(showTrashConfirm.id);
    if (success) {
      toast.success(`"${showTrashConfirm.label}" moved to trash`);
    } else {
      toast.error('Failed to move series to trash');
    }
    setShowTrashConfirm(null);
  };

  const handleDeleteForever = async () => {
    if (!showDeleteConfirm) return;
    const success = await remove(showDeleteConfirm.id);
    if (success) {
      toast.success(`"${showDeleteConfirm.label}" permanently deleted`);
    } else {
      toast.error('Failed to delete series');
    }
    setShowDeleteConfirm(null);
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="series-page loading-state">
        <div className="loading-spinner">Loading series...</div>
      </div>
    );
  }

  return (
    <div className="series-page">
      <div className="series-header">
        <div>
          <h1 className="page-title">Series Management</h1>
          <p className="page-subtitle">Configure product series and their branding colors</p>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
            + Add Series
          </button>
        )}
      </div>

      {series.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="8" width="40" height="32" rx="4" />
              <path d="M4 16h40" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="18" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <h3 className="empty-title">No series configured</h3>
          <p className="empty-desc">Series help organize products by type or brand line</p>
          {isSuperAdmin && (
            <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
              Create First Series
            </button>
          )}
        </div>
      ) : (
        <div className="series-grid">
          {series.map((s) => (
            <div key={s.id} className="series-card">
              <div className="series-card-header" style={{ background: s.accent, color: s.text_on_accent }}>
                {s.icon_url ? (
                  <img src={s.icon_url} alt={s.label} className="series-header-icon" />
                ) : (
                  <div className="series-header-icon-placeholder">
                    {s.label.charAt(0)}
                  </div>
                )}
                <h3>{s.label}</h3>
              </div>
              <div className="series-card-body">
                <div className="series-stats">
                  <div className="stat">
                    <span className="stat-value">{getProductCount(s.id)}</span>
                    <span className="stat-label">Products</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value mono">{s.id}</span>
                    <span className="stat-label">Series ID</span>
                  </div>
                </div>

                <div className="series-colors">
                  <div className="color-item">
                    <div className="color-swatch" style={{ background: s.accent }}></div>
                    <span className="color-info">
                      <span className="color-label">Accent</span>
                      <span className="color-value">{s.accent}</span>
                    </span>
                  </div>
                  <div className="color-item">
                    <div className="color-swatch" style={{ background: s.text_on_accent, border: '1px solid #e5e5e5' }}></div>
                    <span className="color-info">
                      <span className="color-label">Text</span>
                      <span className="color-value">{s.text_on_accent}</span>
                    </span>
                  </div>
                </div>

                {s.description && (
                  <div className="series-description">
                    <p>{s.description}</p>
                  </div>
                )}

                <div className="series-meta">
                  <span>Created: {formatDate(s.created_at)}</span>
                  {s.updated_at && s.updated_at !== s.created_at && (
                    <span>Updated: {formatDate(s.updated_at)}</span>
                  )}
                </div>
              </div>
              <div className="series-card-footer">
                <button className="btn btn-ghost" onClick={() => setViewingSeries(s)}>
                  <ViewIcon />
                  View
                </button>
                {isSuperAdmin && (
                  <>
                    <button className="btn btn-outline" onClick={() => handleEdit(s)}>
                      <EditIcon />
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => setShowTrashConfirm(s)}>
                      <TrashIcon />
                      Trash
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      {viewingSeries && (
        <SeriesDetailModal
          series={viewingSeries}
          productCount={getProductCount(viewingSeries.id)}
          onClose={() => setViewingSeries(null)}
          onEdit={() => {
            setViewingSeries(null);
            handleEdit(viewingSeries);
          }}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Create/Edit Modal */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal series-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h2 className="modal-title">{editingSeries ? 'Edit Series' : 'Create New Series'}</h2>
                <button type="button" className="modal-close" onClick={() => setIsFormOpen(false)}>
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Series ID *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      disabled={!!editingSeries}
                      placeholder="e.g., haemng"
                      required
                    />
                    {editingSeries && (
                      <span className="form-hint">ID cannot be changed after creation</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="Display name"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="input textarea"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this series"
                    rows={3}
                  />
                </div>

                <div className="form-row colors-row">
                  <div className="form-group color-input-group">
                    <label className="form-label">Accent Color</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        className="color-picker"
                        value={formData.accent}
                        onChange={(e) => setFormData({ ...formData, accent: e.target.value })}
                      />
                      <input
                        type="text"
                        className="input color-text"
                        value={formData.accent}
                        onChange={(e) => setFormData({ ...formData, accent: e.target.value })}
                        placeholder="#E8A800"
                      />
                    </div>
                  </div>
                  <div className="form-group color-input-group">
                    <label className="form-label">Text on Accent</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        className="color-picker"
                        value={formData.text_on_accent}
                        onChange={(e) => setFormData({ ...formData, text_on_accent: e.target.value })}
                      />
                      <input
                        type="text"
                        className="input color-text"
                        value={formData.text_on_accent}
                        onChange={(e) => setFormData({ ...formData, text_on_accent: e.target.value })}
                        placeholder="#0e0e0f"
                      />
                    </div>
                  </div>
                </div>

                <div className="color-preview-section">
                  <div className="color-preview-header" style={{ background: formData.accent, color: formData.text_on_accent }}>
                    {formData.label || 'Preview'}
                  </div>
                  <span className="color-preview-label">Color Preview</span>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.use_svg_logo}
                      onChange={(e) => setFormData({ ...formData, use_svg_logo: e.target.checked })}
                    />
                    <span>Use SVG Logo</span>
                  </label>
                </div>

                {formData.use_svg_logo && (
                  <div className="form-group">
                    <label className="form-label">Logo Source</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.logo_src}
                      onChange={(e) => setFormData({ ...formData, logo_src: e.target.value })}
                      placeholder="e.g., haemng.svg"
                    />
                    <span className="form-hint">Filename for SVG logo in assets folder</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Icon URL</label>
                  <input
                    type="url"
                    className="input"
                    value={formData.icon_url || ''}
                    onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                    placeholder="https://example.com/icon.png"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="input"
                    style={{ marginTop: 8 }}
                    disabled={uploadingIcon}
                    onChange={handleIconUpload}
                  />
                  <span className="form-hint">
                    {uploadingIcon ? 'Uploading icon...' : 'Paste an image URL or upload a file (max 1MB). Used as the series thumbnail on the site.'}
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving || uploadingIcon}>
                  {isSaving ? 'Saving...' : editingSeries ? 'Update Series' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move to Trash Confirmation */}
      <ConfirmDialog
        isOpen={!!showTrashConfirm}
        title="Move Series to Trash"
        message={`Move "${showTrashConfirm?.label}" to trash? Products in this series will remain but may need reassignment.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        confirmType="warning"
        requireTyping={showTrashConfirm?.id || ''}
        onConfirm={handleMoveToTrash}
        onCancel={() => setShowTrashConfirm(null)}
      />

      {/* Delete Forever Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        title="Permanently Delete Series"
        message={`This will PERMANENTLY delete "${showDeleteConfirm?.label}" and may affect products assigned to it. This cannot be undone.`}
        confirmText="Delete Forever"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping="DELETE"
        onConfirm={handleDeleteForever}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      <style jsx>{`
        .series-page {
          padding: 24px;
          max-width: 1400px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .series-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: 28px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0 0 8px 0;
          color: var(--color-ink);
        }

        .page-subtitle {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-ink-soft);
          margin: 0;
        }

        .series-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        .series-card {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          overflow: hidden;
          transition: all 150ms ease;
        }

        .series-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .series-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
        }

        .series-header-icon {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: contain;
        }

        .series-header-icon-placeholder {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
        }

        .series-card-header h3 {
          font-family: var(--font-display);
          font-size: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0;
        }

        .series-card-body {
          padding: 20px;
        }

        .series-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .stat-value.mono {
          font-size: 13px;
          color: var(--color-ink-mid);
        }

        .stat-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .series-colors {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .color-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .color-swatch {
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }

        .color-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .color-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .color-value {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink);
        }

        .series-description {
          margin-bottom: 16px;
        }

        .series-description p {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-ink-mid);
          margin: 0;
          line-height: 1.5;
        }

        .series-meta {
          display: flex;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        .series-card-footer {
          display: flex;
          gap: 8px;
          padding: 16px 20px;
          background: var(--color-white-warm);
          border-top: 1px solid var(--color-white-border);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-white-grey);
          border-radius: 12px;
          margin-bottom: 20px;
          color: var(--color-ink-soft);
        }

        .empty-title {
          font-family: var(--font-display);
          font-size: 18px;
          margin: 0 0 8px 0;
          color: var(--color-ink);
        }

        .empty-desc {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-ink-soft);
          margin: 0 0 20px 0;
        }

        /* Modal */
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
          background: var(--color-white-pure);
          border-radius: 8px;
          max-width: 600px;
          width: 100%;
        }

        .series-modal {
          max-width: 600px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid var(--color-white-border);
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 18px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          font-size: 24px;
          color: var(--color-ink-soft);
          cursor: pointer;
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
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-white-border);
          justify-content: flex-end;
        }

        /* Form */
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .colors-row {
          margin-bottom: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
          margin-bottom: 8px;
        }

        .form-hint {
          display: block;
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-soft);
          margin-top: 6px;
        }

        .input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--color-white-border);
          border-radius: 4px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-ink);
        }

        .input:focus {
          outline: none;
          border-color: var(--color-gold);
          box-shadow: 0 0 0 3px rgba(232, 168, 0, 0.1);
        }

        .input:disabled {
          background: var(--color-white-grey);
          color: var(--color-ink-soft);
        }

        .textarea {
          resize: vertical;
          min-height: 80px;
        }

        .color-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .color-picker {
          width: 44px;
          height: 44px;
          border: 1px solid var(--color-white-border);
          border-radius: 4px;
          cursor: pointer;
          padding: 4px;
        }

        .color-text {
          flex: 1;
        }

        .color-preview-section {
          margin-bottom: 16px;
        }

        .color-preview-header {
          padding: 16px 24px;
          border-radius: 6px;
          font-family: var(--font-display);
          font-size: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .color-preview-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .checkbox-group {
          margin-bottom: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }

        .checkbox-label span {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-ink);
        }

        /* Buttons */
        .btn {
          padding: 10px 16px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
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

        .btn-outline {
          background: transparent;
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-outline:hover {
          background: var(--color-white-grey);
        }

        .btn-primary {
          background: var(--color-gold);
          border-color: var(--color-gold);
          color: var(--color-ink);
        }

        .btn-primary:hover:not(:disabled) {
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

        .btn-danger {
          background: transparent;
          border-color: var(--color-error);
          color: var(--color-error);
        }

        .btn-danger:hover {
          background: var(--color-error);
          color: white;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// Icon Components
function ViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 2l3 3-8 8H3V9l8-8z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 5h6M6 5V4h2v1M5 5v6a1 1 0 001 1h2a1 1 0 001-1V5" />
      <path d="M7 7v3" />
    </svg>
  );
}

// Series Detail Modal Component
function SeriesDetailModal({ series, productCount, onClose, onEdit, isSuperAdmin }: {
  series: Series;
  productCount: number;
  onClose: () => void;
  onEdit?: () => void;
  isSuperAdmin: boolean;
}) {
  const formatDate = (date: string | undefined) => {
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
      <div className="modal series-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-banner" style={{ background: series.accent, color: series.text_on_accent }}>
          {series.icon_url && (
            <img src={series.icon_url} alt={series.label} className="series-detail-icon" />
          )}
          <div>
            <h2 className="modal-title">{series.label}</h2>
            <p className="modal-subtitle">{series.id}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Stats */}
          <div className="detail-stats">
            <div className="stat-box">
              <span className="stat-number">{productCount}</span>
              <span className="stat-text">Products</span>
            </div>
            <div className="stat-box">
              <span className="stat-status">{series.use_svg_logo ? 'SVG Logo' : 'Standard'}</span>
              <span className="stat-text">Logo Type</span>
            </div>
          </div>

          {/* Colors */}
          <div className="detail-section">
            <h3 className="section-title">Brand Colors</h3>
            <div className="color-display">
              <div className="color-box">
                <div className="color-preview-large" style={{ background: series.accent }}></div>
                <div className="color-info">
                  <span className="color-name">Accent</span>
                  <span className="color-hex">{series.accent}</span>
                </div>
              </div>
              <div className="color-box">
                <div className="color-preview-large" style={{ background: series.text_on_accent, border: '1px solid #e5e5e5' }}></div>
                <div className="color-info">
                  <span className="color-name">Text</span>
                  <span className="color-hex">{series.text_on_accent}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="detail-section">
            <h3 className="section-title">Preview</h3>
            <div className="series-preview-card" style={{ background: series.accent, color: series.text_on_accent }}>
              {series.icon_url && (
                <img src={series.icon_url} alt={series.label} className="preview-icon" />
              )}
              <span className="preview-label">{series.label}</span>
            </div>
          </div>

          {/* Details */}
          <div className="detail-section">
            <h3 className="section-title">Details</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Series ID</span>
                <span className="detail-value mono">{series.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Label</span>
                <span className="detail-value">{series.label}</span>
              </div>
              {series.description && (
                <div className="detail-item full-width">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{series.description}</span>
                </div>
              )}
              {series.logo_src && (
                <div className="detail-item">
                  <span className="detail-label">Logo Source</span>
                  <span className="detail-value mono">{series.logo_src}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value mono">{formatDate(series.created_at)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Last Updated</span>
                <span className="detail-value mono">{formatDate(series.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {isSuperAdmin && onEdit && (
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              Edit Series
            </button>
          )}
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

          .series-detail-modal {
            max-width: 700px;
            width: 100%;
          }

          .modal {
            background: var(--color-white-pure);
            border-radius: 8px;
          }

          .modal-header-banner {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 20px 24px;
            border-radius: 8px 8px 0 0;
          }

          .series-detail-icon {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            object-fit: contain;
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
            opacity: 0.7;
            margin: 4px 0 0 0;
          }

          .modal-close {
            position: absolute;
            right: 16px;
            top: 16px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.2);
            border: none;
            font-size: 20px;
            cursor: pointer;
            border-radius: 4px;
          }

          .modal-body {
            padding: 24px;
          }

          .modal-footer {
            display: flex;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid var(--color-white-border);
            justify-content: flex-end;
          }

          .detail-stats {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
          }

          .stat-box {
            flex: 1;
            padding: 16px;
            background: var(--color-white-grey);
            border-radius: 6px;
            text-align: center;
          }

          .stat-number {
            font-family: var(--font-mono);
            font-size: 24px;
            font-weight: 700;
            color: var(--color-ink);
            display: block;
          }

          .stat-status {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 600;
            color: var(--color-ink);
            display: block;
          }

          .stat-text {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--color-ink-soft);
          }

          .detail-section {
            margin-bottom: 24px;
          }

          .section-title {
            font-family: var(--font-display);
            font-size: 12px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--color-ink);
            margin: 0 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--color-gold);
          }

          .color-display {
            display: flex;
            gap: 24px;
          }

          .color-box {
            display: flex;
            gap: 16px;
            flex: 1;
          }

          .color-preview-large {
            width: 80px;
            height: 80px;
            border-radius: 8px;
          }

          .color-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .color-name {
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--color-ink-soft);
          }

          .color-hex {
            font-family: var(--font-mono);
            font-size: 16px;
            font-weight: 600;
            color: var(--color-ink);
          }

          .series-preview-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 24px;
            border-radius: 8px;
          }

          .preview-icon {
            width: 40px;
            height: 40px;
            border-radius: 6px;
          }

          .preview-label {
            font-family: var(--font-display);
            font-size: 18px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .detail-item.full-width {
            grid-column: span 2;
          }

          .detail-label {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--color-ink-soft);
          }

          .detail-value {
            font-family: var(--font-body);
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
            transition: all 150ms ease;
          }

          .btn-secondary {
            background: var(--color-white-pure);
            border: 1px solid var(--color-white-border);
            color: var(--color-ink);
          }

          .btn-secondary:hover {
            background: var(--color-white-grey);
          }

          .btn-primary {
            background: var(--color-gold);
            border: 1px solid var(--color-gold);
            color: var(--color-ink);
          }

          .btn-primary:hover {
            filter: brightness(1.1);
          }
        `}</style>
      </div>
    </div>
  );
}