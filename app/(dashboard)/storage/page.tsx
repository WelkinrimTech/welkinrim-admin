'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/apiFetch';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  created_at?: string;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
}

interface FileItem {
  name: string;
  id: string;
  created_at: string | null;
  updated_at?: string | null;
  size?: number;
  metadata?: Record<string, unknown> | null;
}

export default function StoragePage() {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [activeBucket, setActiveBucket] = useState<Bucket | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteFileConfirm, setShowDeleteFileConfirm] = useState<string | null>(null);
  const [showDeleteBucketConfirm, setShowDeleteBucketConfirm] = useState<string | null>(null);
  const [showEmptyBucketConfirm, setShowEmptyBucketConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Create/Edit bucket modal
  const [showBucketModal, setShowBucketModal] = useState(false);
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
  const [bucketName, setBucketName] = useState('');
  const [bucketPublic, setBucketPublic] = useState(true);
  const [bucketFileSizeLimit, setBucketFileSizeLimit] = useState<string>(''); // in MB
  const [bucketAllowedMimeTypes, setBucketAllowedMimeTypes] = useState<string>('');
  const [savingBucket, setSavingBucket] = useState(false);

  const loadBuckets = async () => {
    setLoadingBuckets(true);
    const response = await authFetch('/api/storage?action=listBuckets');
    const data = await response.json();

    if (data.error) {
      toast.error('Failed to load buckets: ' + data.error);
      setBuckets([]);
    } else {
      setBuckets(data.buckets || []);
    }
    setLoadingBuckets(false);
  };

  useEffect(() => {
    loadBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only load
  }, []);

  const loadFiles = async (bucketName: string) => {
    setLoadingFiles(true);
    setSelectedFiles([]);

    const { data, error } = await supabase.storage.from(bucketName).list();
    if (error) {
      toast.error('Failed to load files: ' + error.message);
      setFiles([]);
    } else {
      setFiles((data || []).map(f => ({
        name: f.name,
        id: f.id || f.name,
        created_at: f.created_at,
        updated_at: f.updated_at,
        size: f.metadata?.size,
        metadata: f.metadata,
      })));
    }
    setLoadingFiles(false);
  };

  const selectBucket = (bucket: Bucket) => {
    setActiveBucket(bucket);
    loadFiles(bucket.name);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBucket) return;

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setUploading(true);
    const { error } = await supabase.storage.from(activeBucket.name).upload(file.name, file, {
      upsert: true,
    });

    if (error) {
      toast.error('Upload failed: ' + error.message);
    } else {
      toast.success('File uploaded successfully');
      loadFiles(activeBucket.name);
      setShowUploadModal(false);
    }
    setUploading(false);
  };

  const handleDeleteFile = async () => {
    if (!activeBucket || !showDeleteFileConfirm) return;

    const response = await authFetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteFile',
        bucket: activeBucket.name,
        fileName: showDeleteFileConfirm,
      }),
    });

    const data = await response.json();
    if (data.error) {
      toast.error('Failed to delete file: ' + data.error);
    } else {
      toast.success('File deleted');
      loadFiles(activeBucket.name);
    }
    setShowDeleteFileConfirm(null);
  };

  const handleBulkDeleteFiles = async () => {
    if (!activeBucket || selectedFiles.length === 0) return;

    const response = await authFetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteFiles',
        bucket: activeBucket.name,
        fileNames: selectedFiles,
      }),
    });

    const data = await response.json();
    if (data.error) {
      toast.error('Failed to delete files: ' + data.error);
    } else {
      toast.success(`${selectedFiles.length} files deleted`);
      loadFiles(activeBucket.name);
    }
    setSelectedFiles([]);
    setShowBulkDeleteConfirm(false);
  };

  const openCreateBucketModal = () => {
    setEditingBucket(null);
    setBucketName('');
    setBucketPublic(true);
    setBucketFileSizeLimit('');
    setBucketAllowedMimeTypes('');
    setShowBucketModal(true);
  };

  const openEditBucketModal = (bucket: Bucket) => {
    setEditingBucket(bucket);
    setBucketName(bucket.name);
    setBucketPublic(bucket.public);
    setBucketFileSizeLimit(bucket.file_size_limit ? (bucket.file_size_limit / (1024 * 1024)).toString() : '');
    setBucketAllowedMimeTypes(bucket.allowed_mime_types?.join(', ') || '');
    setShowBucketModal(true);
  };

  const handleSaveBucket = async () => {
    if (!bucketName.trim()) {
      toast.error('Bucket name required');
      return;
    }

    setSavingBucket(true);

    const validName = bucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const fileSizeLimitBytes = bucketFileSizeLimit ? parseInt(bucketFileSizeLimit) * 1024 * 1024 : null;
    const mimeTypes = bucketAllowedMimeTypes
      ? bucketAllowedMimeTypes.split(',').map(t => t.trim()).filter(t => t)
      : null;

    const payload = {
      action: editingBucket ? 'updateBucket' : 'createBucket',
      bucket: editingBucket ? editingBucket.name : validName,
      isPublic: bucketPublic,
      fileSizeLimit: fileSizeLimitBytes,
      allowedMimeTypes: mimeTypes,
    };

    const response = await authFetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.error) {
      toast.error('Failed to save bucket: ' + data.error);
    } else {
      toast.success(editingBucket ? 'Bucket updated' : 'Bucket created');
      setShowBucketModal(false);
      loadBuckets();
    }
    setSavingBucket(false);
  };

  const handleDeleteBucket = async () => {
    if (!showDeleteBucketConfirm) return;

    const response = await authFetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteBucket',
        bucket: showDeleteBucketConfirm,
      }),
    });

    const data = await response.json();
    if (data.error) {
      toast.error('Failed to delete bucket: ' + data.error);
    } else {
      toast.success('Bucket deleted');
      loadBuckets();
      setActiveBucket(null);
      setFiles([]);
    }
    setShowDeleteBucketConfirm(null);
  };

  const handleEmptyBucket = async () => {
    if (!activeBucket) return;

    const response = await authFetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'emptyBucket',
        bucket: activeBucket.name,
      }),
    });

    const data = await response.json();
    if (data.error) {
      toast.error('Failed to empty bucket: ' + data.error);
    } else {
      toast.success(`Bucket emptied (${data.deletedCount} files removed)`);
      loadFiles(activeBucket.name);
    }
    setShowEmptyBucketConfirm(false);
  };

  const getPublicUrl = (bucketName: string, fileName: string) => {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  const formatBytesLimit = (bytes?: number | null) => {
    if (!bytes) return 'No limit';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div className="storage-page">
      <div className="storage-header">
        <div>
          <h1 className="page-title">Storage Space</h1>
          <p className="page-subtitle">Manage file buckets and assets</p>
        </div>
        <div className="header-actions">
          {isSuperAdmin && (
            <button className="btn btn-secondary" onClick={openCreateBucketModal}>
              + Create Bucket
            </button>
          )}
          {activeBucket && (
            <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
              Upload File
            </button>
          )}
        </div>
      </div>

      <div className="storage-layout">
        {/* Buckets Sidebar */}
        <div className="buckets-panel">
          <h2 className="panel-title">Buckets ({buckets.length})</h2>
          {loadingBuckets ? (
            <div className="loading">Loading...</div>
          ) : buckets.length === 0 ? (
            <div className="empty">
              <p>No buckets available</p>
              {isSuperAdmin && (
                <button className="btn btn-sm btn-primary" onClick={openCreateBucketModal}>
                  Create Bucket
                </button>
              )}
            </div>
          ) : (
            <div className="bucket-list">
              {buckets.map(bucket => (
                <div
                  key={bucket.id}
                  className={`bucket-item ${activeBucket?.name === bucket.name ? 'active' : ''}`}
                  onClick={() => selectBucket(bucket)}
                >
                  <div className="bucket-info">
                    <span className="bucket-name">{bucket.name}</span>
                    <div className="bucket-meta">
                      <span className={`bucket-visibility ${bucket.public ? 'public' : 'private'}`}>
                        {bucket.public ? 'PUBLIC' : 'PRIVATE'}
                      </span>
                    </div>
                  </div>
                  <div className="bucket-actions">
                    {isSuperAdmin && (
                      <>
                        <button
                          className="btn-icon-sm"
                          onClick={(e) => { e.stopPropagation(); openEditBucketModal(bucket); }}
                          title="Edit bucket settings"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="btn-icon-sm delete"
                          onClick={(e) => { e.stopPropagation(); setShowDeleteBucketConfirm(bucket.name); }}
                          title="Delete bucket"
                        >
                          <DeleteIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Files Panel */}
        <div className="files-panel">
          {activeBucket ? (
            <>
              {/* Bucket Details */}
              <div className="bucket-details">
                <div className="bucket-detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{activeBucket.name}</span>
                </div>
                <div className="bucket-detail-row">
                  <span className="detail-label">Access</span>
                  <span className={`detail-value ${activeBucket.public ? 'public' : 'private'}`}>
                    {activeBucket.public ? 'Public' : 'Private'}
                  </span>
                </div>
                <div className="bucket-detail-row">
                  <span className="detail-label">Size Limit</span>
                  <span className="detail-value">{formatBytesLimit(activeBucket.file_size_limit)}</span>
                </div>
                <div className="bucket-detail-row">
                  <span className="detail-label">Allowed Types</span>
                  <span className="detail-value mime-types">
                    {activeBucket.allowed_mime_types && activeBucket.allowed_mime_types.length > 0
                      ? activeBucket.allowed_mime_types.join(', ')
                      : 'All types'}
                  </span>
                </div>
                {isSuperAdmin && (
                  <div className="bucket-detail-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditBucketModal(activeBucket)}
                    >
                      Edit Settings
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setShowDeleteBucketConfirm(activeBucket.name)}
                    >
                      Delete Bucket
                    </button>
                  </div>
                )}
              </div>

              <div className="files-header">
                <div className="files-search">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="files-actions">
                  {selectedFiles.length > 0 && (
                    <>
                      <span className="selected-count">{selectedFiles.length} selected</span>
                      <button className="btn btn-sm btn-danger" onClick={() => setShowBulkDeleteConfirm(true)}>
                        Delete Selected
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setSelectedFiles([])}>
                        Clear
                      </button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <button className="btn btn-sm btn-outline" onClick={() => setShowEmptyBucketConfirm(true)}>
                      Empty Bucket
                    </button>
                  )}
                </div>
              </div>

              {loadingFiles ? (
                <div className="loading">Loading files...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="empty">
                  <p>No files in this bucket</p>
                  <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                    Upload File
                  </button>
                </div>
              ) : (
                <div className="files-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                            onChange={() => {
                              if (selectedFiles.length === filteredFiles.length) {
                                setSelectedFiles([]);
                              } else {
                                setSelectedFiles(filteredFiles.map(f => f.name));
                              }
                            }}
                          />
                        </th>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map(file => (
                        <tr key={file.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedFiles.includes(file.name)}
                              onChange={() => {
                                if (selectedFiles.includes(file.name)) {
                                  setSelectedFiles(selectedFiles.filter(n => n !== file.name));
                                } else {
                                  setSelectedFiles([...selectedFiles, file.name]);
                                }
                              }}
                            />
                          </td>
                          <td className="file-name">{file.name}</td>
                          <td className="mono">{formatFileSize((file.metadata?.size as number | undefined) || file.size)}</td>
                          <td className="mono">{file.created_at ? new Date(file.created_at).toLocaleDateString() : '—'}</td>
                          <td className="actions-cell">
                            {activeBucket.public && (
                              <button
                                className="btn-icon"
                                onClick={() => window.open(getPublicUrl(activeBucket.name, file.name), '_blank')}
                                title="View file"
                              >
                                <ViewIcon />
                              </button>
                            )}
                            <button
                              className="btn-icon"
                              onClick={() => {
                                navigator.clipboard.writeText(getPublicUrl(activeBucket.name, file.name));
                                toast.success('URL copied');
                              }}
                              title="Copy URL"
                            >
                              <CopyIcon />
                            </button>
                            {isSuperAdmin && (
                              <button
                                className="btn-icon delete"
                                onClick={() => setShowDeleteFileConfirm(file.name)}
                                title="Delete"
                              >
                                <DeleteIcon />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon-container">
                <div className="empty-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25">
                    <rect x="4" y="8" width="24" height="16" rx="2" />
                    <path d="M4 13h24" />
                    <circle cx="9" cy="10.5" r="1.25" fill="currentColor" />
                    <circle cx="13" cy="10.5" r="1.25" fill="currentColor" />
                    <path d="M10 17.5h12M10 20.5h8" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </div>
              </div>
              <p className="empty-title">No bucket selected</p>
              <p className="empty-description">Select a bucket from the left panel to browse and manage its files.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && activeBucket && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Upload to {activeBucket.name}</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select File</label>
                  <input type="file" name="file" className="file-input" required />
                </div>
                {activeBucket.allowed_mime_types && activeBucket.allowed_mime_types.length > 0 && (
                  <div className="upload-info">
                    Allowed file types: {activeBucket.allowed_mime_types.join(', ')}
                  </div>
                )}
                {activeBucket.file_size_limit && (
                  <div className="upload-info">
                    Max file size: {formatBytesLimit(activeBucket.file_size_limit)}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Bucket Modal */}
      {showBucketModal && (
        <div className="modal-overlay" onClick={() => setShowBucketModal(false)}>
          <div className="modal bucket-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingBucket ? 'Edit Bucket' : 'Create New Bucket'}</h3>
              <button className="modal-close" onClick={() => setShowBucketModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Bucket Name</label>
                <input
                  type="text"
                  className="input"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g., product-images"
                  disabled={!!editingBucket}
                />
                {editingBucket && (
                  <span className="form-hint">Bucket name cannot be changed after creation</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Public Access</label>
                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-label">{bucketPublic ? 'Public' : 'Private'}</span>
                    <span className="toggle-desc">
                      {bucketPublic ? 'Files accessible without authentication' : 'Files require authentication'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`toggle-btn ${bucketPublic ? 'active' : ''}`}
                    onClick={() => setBucketPublic(!bucketPublic)}
                  >
                    {bucketPublic ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">File Size Limit (MB)</label>
                <input
                  type="number"
                  className="input"
                  value={bucketFileSizeLimit}
                  onChange={(e) => setBucketFileSizeLimit(e.target.value)}
                  placeholder="No limit (e.g., 10 for 10MB)"
                  min="1"
                />
                <span className="form-hint">Maximum file size in megabytes. Leave empty for no limit.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Allowed MIME Types</label>
                <input
                  type="text"
                  className="input"
                  value={bucketAllowedMimeTypes}
                  onChange={(e) => setBucketAllowedMimeTypes(e.target.value)}
                  placeholder="image/jpeg, image/png, image/svg+xml"
                />
                <span className="form-hint">Comma-separated list. Leave empty to allow all types.</span>
              </div>

              <div className="modal-info">
                <div className="modal-info-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v2M8 9h.01" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="modal-info-text">
                  <strong>Public buckets</strong> are required for website assets to be viewable without authentication.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBucketModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveBucket} disabled={savingBucket}>
                {savingBucket ? 'Saving...' : (editingBucket ? 'Update Bucket' : 'Create Bucket')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={!!showDeleteFileConfirm}
        title="Delete File"
        message={`You are about to permanently delete "${showDeleteFileConfirm}". This action cannot be undone.`}
        confirmText="Delete File"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping={showDeleteFileConfirm || ''}
        onConfirm={handleDeleteFile}
        onCancel={() => setShowDeleteFileConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!showDeleteBucketConfirm}
        title="Delete Bucket"
        message={`Deleting "${showDeleteBucketConfirm}" will permanently remove the bucket and ALL files inside it. This action cannot be undone.`}
        confirmText="Delete Bucket"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping={showDeleteBucketConfirm || ''}
        onConfirm={handleDeleteBucket}
        onCancel={() => setShowDeleteBucketConfirm(null)}
      />

      <ConfirmDialog
        isOpen={showEmptyBucketConfirm}
        title="Empty Bucket"
        message={`This will permanently delete ALL files in "${activeBucket?.name}". The bucket will remain but all contents will be lost. This action cannot be undone.`}
        confirmText="Empty Bucket"
        cancelText="Cancel"
        confirmType="danger"
        requireTyping={activeBucket?.name || ''}
        onConfirm={handleEmptyBucket}
        onCancel={() => setShowEmptyBucketConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Multiple Files"
        message={`You are about to permanently delete ${selectedFiles.length} files from "${activeBucket?.name}". This action cannot be undone.`}
        confirmText={`Delete ${selectedFiles.length} Files`}
        cancelText="Cancel"
        confirmType="danger"
        requireTyping="DELETE"
        onConfirm={handleBulkDeleteFiles}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      <style jsx>{`
        .storage-page {
          padding: 24px;
          max-width: 1400px;
        }

        .storage-header {
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

        .storage-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          min-height: 500px;
        }

        .buckets-panel {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 20px;
        }

        .panel-title {
          font-family: var(--font-display);
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin: 0 0 16px 0;
        }

        .bucket-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bucket-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-white-grey);
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms;
        }

        .bucket-item:hover {
          background: rgba(232, 168, 0, 0.1);
          border: 1px solid var(--color-gold);
        }

        .bucket-item.active {
          background: var(--color-gold);
          border: 1px solid var(--color-gold);
        }

        .bucket-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .bucket-name {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .bucket-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .bucket-visibility {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 3px 6px;
          border-radius: 3px;
        }

        .bucket-visibility.public {
          background: #d1fae5;
          color: #065f46;
        }

        .bucket-visibility.private {
          background: #fef2f2;
          color: #991b1b;
        }

        .bucket-actions {
          display: flex;
          gap: 4px;
        }

        .files-panel {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 20px;
          min-height: 400px;
        }

        /* Bucket Details */
        .bucket-details {
          display: grid;
          grid-template-columns: repeat(4, 1fr) auto;
          gap: 12px;
          padding: 16px;
          background: var(--color-white-grey);
          border-radius: 4px;
          margin-bottom: 16px;
          align-items: center;
        }

        .bucket-detail-row {
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
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink);
        }

        .detail-value.public {
          color: #065f46;
        }

        .detail-value.private {
          color: #991b1b;
        }

        .mime-types {
          font-size: 12px;
          color: var(--color-ink-mid);
        }

        .bucket-detail-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          padding-top: 8px;
        }

        .files-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .files-search {
          flex: 1;
        }

        .files-search .input {
          width: 100%;
        }

        .files-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .selected-count {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink);
          background: var(--color-gold);
          padding: 4px 10px;
          border-radius: 3px;
        }

        .files-table {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 12px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
          background: var(--color-white-warm);
          border-bottom: 1px solid var(--color-white-border);
          text-align: left;
        }

        .data-table td {
          padding: 12px;
          border-bottom: 1px solid var(--color-white-border);
        }

        .checkbox-col {
          width: 40px;
        }

        .file-name {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink);
        }

        .mono {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-mid);
        }

        .actions-cell {
          display: flex;
          gap: 4px;
          justify-content: flex-end;
        }

        .btn-icon {
          width: 28px;
          height: 28px;
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

        .btn-icon.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .btn-icon svg {
          width: 16px;
          height: 16px;
        }

        .btn-icon-sm {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: var(--color-ink-soft);
        }

        .btn-icon-sm:hover {
          background: var(--color-white-grey);
          color: var(--color-ink);
        }

        .btn-icon-sm.delete:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .btn-icon-sm svg {
          width: 14px;
          height: 14px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
          min-height: 320px;
        }

        .empty-icon-container {
          margin-bottom: 1.5rem;
        }

        .empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 8px;
          background: var(--color-white-grey);
          border: 1px solid var(--color-white-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-ink-soft);
        }

        .empty-title {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0 0 6px;
        }

        .empty-description {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-ink-soft);
          margin: 0;
        }

        .empty {
          text-align: center;
          padding: 40px 20px;
        }

        .empty p {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink-soft);
          margin-bottom: 16px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink-soft);
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
          max-width: 420px;
          width: 100%;
        }

        .bucket-modal {
          max-width: 500px;
        }

        .upload-modal {
          max-width: 420px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-white-border);
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 18px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
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

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .form-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .form-hint {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .input {
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

        .file-input {
          width: 100%;
          padding: 12px;
          border: 1px dashed var(--color-white-border);
          border-radius: 4px;
          cursor: pointer;
        }

        .upload-info {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-mid);
          padding: 8px 12px;
          background: var(--color-white-grey);
          border-radius: 4px;
          margin-top: 8px;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-white-grey);
          border-radius: 4px;
        }

        .toggle-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toggle-label {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .toggle-desc {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .toggle-btn {
          padding: 6px 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          color: var(--color-ink-soft);
          transition: all 150ms;
        }

        .toggle-btn.active {
          background: var(--color-gold);
          border-color: var(--color-gold);
          color: var(--color-ink);
        }

        .modal-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 6px;
        }

        .modal-info-icon {
          color: #92400e;
          flex-shrink: 0;
        }

        .modal-info-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: #78350f;
          line-height: 1.5;
        }

        .modal-info-text strong {
          font-weight: 600;
        }

        /* Buttons */
        .btn {
          padding: 10px 18px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms;
          border: 1px solid transparent;
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

        .btn-sm {
          padding: 6px 12px;
          font-size: 10px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
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

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M3 11V4a1 1 0 011-1h7" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 5h8M6 5V4h4v1M5 5v7a1 1 0 001 1h4a1 1 0 001-1V5" />
      <path d="M7 7v4M9 7v4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 2l3 3-8 8H3V9l8-8z" />
    </svg>
  );
}