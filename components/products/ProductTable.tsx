'use client';

import { useState } from 'react';
import { SupabaseProduct, getProductDomain, getWeight, getSegments, SEGMENT_OPTIONS } from '@/lib/products';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface ProductTableProps {
  products: SupabaseProduct[];
  sortKey: 'model' | 'series' | 'category' | 'weight';
  sortDir: 'asc' | 'desc';
  onSort: (key: 'model' | 'series' | 'category' | 'weight') => void;
  onEdit: (product: SupabaseProduct) => void;
  onDelete: (id: string) => void;
  onView?: (product: SupabaseProduct) => void;
  onDuplicate?: (product: SupabaseProduct) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkPublish?: (ids: string[]) => void;
  onBulkUnpublish?: (ids: string[]) => void;
  onBulkMoveToTrash?: (ids: string[]) => void;
}

export function ProductTable({
  products,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onView,
  onDuplicate,
  onPublish,
  onUnpublish,
  onBulkDelete,
  onBulkPublish,
  onBulkUnpublish,
  onBulkMoveToTrash,
}: ProductTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkTrashConfirm, setShowBulkTrashConfirm] = useState(false);

  const allSelected = selectedIds.length === products.length && products.length > 0;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const selectedPublished = products.filter(p => selectedIds.includes(p.id) && p.is_published).length;
  const selectedUnpublished = products.filter(p => selectedIds.includes(p.id) && !p.is_published).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
    }
  };

  const handleBulkTrash = () => {
    if (onBulkMoveToTrash) {
      onBulkMoveToTrash(selectedIds);
      setSelectedIds([]);
      setShowBulkTrashConfirm(false);
    }
  };

  const handleBulkPublish = () => {
    if (onBulkPublish) {
      onBulkPublish(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleBulkUnpublish = () => {
    if (onBulkUnpublish) {
      onBulkUnpublish(selectedIds);
      setSelectedIds([]);
    }
  };

  if (products.length === 0) {
    return (
      <div className="empty-state">
        <EmptyIcon />
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bulk-toolbar">
          <div className="bulk-info">
            <span className="bulk-count">{selectedIds.length} selected</span>
            <span className="bulk-detail">
              ({selectedPublished} published, {selectedUnpublished} drafts)
            </span>
          </div>
          <div className="bulk-actions">
            {selectedUnpublished > 0 && onBulkPublish && (
              <button className="btn btn-sm btn-secondary" onClick={handleBulkPublish}>
                Publish ({selectedUnpublished})
              </button>
            )}
            {selectedPublished > 0 && onBulkUnpublish && (
              <button className="btn btn-sm btn-outline" onClick={handleBulkUnpublish}>
                Unpublish ({selectedPublished})
              </button>
            )}
            {onBulkMoveToTrash && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowBulkTrashConfirm(true)}>
                Move to Trash
              </button>
            )}
            {onBulkDelete && (
              <button className="btn btn-sm btn-danger" onClick={() => setShowBulkDeleteConfirm(true)}>
                Delete Permanently
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  title="Select all"
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someSelected;
                    }
                  }}
                />
              </th>
              <th className="model-col" onClick={() => onSort('model')}>
                Model {getSortIcon(sortKey, 'model', sortDir)}
              </th>
              <th onClick={() => onSort('series')}>
                Series {getSortIcon(sortKey, 'series', sortDir)}
              </th>
              <th onClick={() => onSort('category')}>
                Category {getSortIcon(sortKey, 'category', sortDir)}
              </th>
              <th>Segments</th>
              <th>Status</th>
              <th onClick={() => onSort('weight')}>
                Weight {getSortIcon(sortKey, 'weight', sortDir)}
              </th>
              <th className="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const domain = getProductDomain(product);
              const weight = getWeight(product);
              const thumbnailUrl = product.thumbnailUrl;
              const isSelected = selectedIds.includes(product.id);

              return (
                <tr
                  key={product.id}
                  className={`product-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => onView?.(product)}
                  style={{ cursor: onView ? 'pointer' : 'default' }}
                >
                  <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </td>
                  <td className="model-col">
                    <div className="model-content">
                      {thumbnailUrl && (
                        <img
                          src={thumbnailUrl}
                          alt={product.model}
                          className="thumbnail"
                        />
                      )}
                      <div className="model-info">
                        <span className="model-name">{product.name || product.model}</span>
                        <span className="model-id">{product.id}</span>
                        {product.tag && <span className="model-tag">{product.tag}</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="series-badge">{product.seriesLabel || product.series}</span>
                  </td>
                  <td>
                    <DomainBadge domain={domain} />
                  </td>
                  <td>
                    {getSegments(product).map(id => SEGMENT_OPTIONS.find(o => o.id === id)?.label ?? id).join(', ')}
                  </td>
                  <td>
                    <StatusBadge isPublished={product.is_published} />
                  </td>
                  <td className="mono">
                    {weight !== '—' ? `${weight}g` : '—'}
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="quick-actions">
                      {onView && (
                        <button
                          className="btn-icon"
                          onClick={() => onView(product)}
                          title="View details"
                        >
                          <ViewIcon />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => onEdit(product)}
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      {onDuplicate && (
                        <button
                          className="btn-icon"
                          onClick={() => onDuplicate(product)}
                          title="Duplicate"
                        >
                          <DuplicateIcon />
                        </button>
                      )}
                      {product.is_published && onUnpublish && (
                        <button
                          className="btn-icon"
                          onClick={() => onUnpublish(product.id)}
                          title="Unpublish"
                        >
                          <UnpublishIcon />
                        </button>
                      )}
                      {!product.is_published && onPublish && (
                        <button
                          className="btn-icon publish"
                          onClick={() => onPublish(product.id)}
                          title="Publish"
                        >
                          <PublishIcon />
                        </button>
                      )}
                      <button
                        className="btn-icon delete"
                        onClick={() => onDelete(product.id)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showBulkTrashConfirm}
        title="Move to Trash"
        message={`Are you sure you want to move ${selectedIds.length} products to trash? They can be restored later from the Trash page.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleBulkTrash}
        onCancel={() => setShowBulkTrashConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Permanently"
        message={`Are you sure you want to permanently delete ${selectedIds.length} products? This action CANNOT be undone!`}
        confirmText="Delete Forever"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      <style jsx>{`
        .table-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .bulk-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-gold);
          border-radius: 4px 4px 0 0;
        }

        .bulk-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bulk-count {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          color: var(--color-ink);
        }

        .bulk-detail {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-mid);
        }

        .bulk-actions {
          display: flex;
          gap: 8px;
        }

        .table-container {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 0 0 4px 4px;
          overflow: hidden;
        }

        .bulk-toolbar + .table-container {
          border-radius: 0 0 4px 4px;
          border-top: none;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: var(--color-ink-soft);
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 4px;
        }

        .empty-state svg {
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state p {
          font-family: var(--font-mono);
          font-size: 14px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px 16px;
          text-align: left;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
          background: var(--color-white-warm);
          border-bottom: 1px solid var(--color-white-border);
          cursor: pointer;
          user-select: none;
          transition: background 150ms;
        }

        .data-table th:hover {
          background: var(--color-white-grey);
        }

        .checkbox-col {
          width: 40px;
          text-align: center;
          cursor: default;
        }

        .checkbox-col:hover {
          background: var(--color-white-warm);
        }

        .checkbox-col input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .model-col {
          width: 280px;
        }

        .actions-header {
          width: 180px;
          text-align: center;
        }

        .product-row {
          transition: background 150ms;
        }

        .product-row:hover {
          background: rgba(232, 168, 0, 0.04);
        }

        .product-row.selected {
          background: rgba(232, 168, 0, 0.08);
        }

        .product-row td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-white-border);
        }

        .checkbox-cell {
          text-align: center;
        }

        .checkbox-cell input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .model-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .thumbnail {
          width: 56px;
          height: 42px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid var(--color-white-border);
        }

        .model-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .model-name {
          font-weight: 500;
          color: var(--color-ink);
        }

        .model-id {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        .model-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-gold);
          background: rgba(232, 168, 0, 0.1);
          padding: 2px 6px;
          border-radius: 2px;
          display: inline-block;
        }

        .series-badge {
          display: inline-block;
          padding: 4px 10px;
          background: var(--color-white-grey);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink);
        }

        .mono {
          font-family: var(--font-mono);
          font-size: 13px;
        }

        .actions-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .quick-actions {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: var(--color-ink-soft);
          transition: all 150ms;
        }

        .btn-icon:hover {
          background: var(--color-white-grey);
          color: var(--color-ink);
        }

        .btn-icon.publish:hover {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }

        .btn-icon.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .btn-icon svg {
          width: 16px;
          height: 16px;
        }

        .btn {
          padding: 8px 14px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms;
          border: 1px solid transparent;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 10px;
        }

        .btn-secondary {
          background: var(--color-white-pure);
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-secondary:hover {
          background: var(--color-white-grey);
        }

        .btn-outline {
          background: transparent;
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-outline:hover {
          background: var(--color-white-grey);
        }

        .btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .btn-ghost {
          background: transparent;
          border-color: transparent;
          color: var(--color-ink-soft);
        }

        .btn-ghost:hover {
          color: var(--color-ink);
        }
      `}</style>
    </div>
  );
}

function getSortIcon(key: string, current: string, dir: 'asc' | 'desc') {
  if (key !== current) return '';
  return dir === 'asc' ? ' ▲' : ' ▼';
}

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className={`badge badge-${domain}`}>
      {domain}
    </span>
  );
}

function StatusBadge({ isPublished }: { isPublished?: boolean }) {
  if (isPublished) {
    return (
      <span className="status-badge published">
        Published
      </span>
    );
  }
  return (
    <span className="status-badge draft">
      Draft
    </span>
  );
}

function ViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 2.5l2 2-7.5 7.5H4v-2l7.5-7.5z" />
      <path d="M8.5 4.5l2 2" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M3 11V4a1 1 0 011-1h7" />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v12M4 6l4-4 4 4" />
    </svg>
  );
}

function UnpublishIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 14V2M4 10l4 4 4-4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4v8a1 1 0 001 1h6a1 1 0 001-1V4" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="8" y="12" width="32" height="24" rx="2" />
      <path d="M16 24h16M24 20v8" />
    </svg>
  );
}