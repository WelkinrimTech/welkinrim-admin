'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProductActions } from '@/hooks/useProductActions';
import { useSeries } from '@/hooks/useSeries';
import { uploadProductThumbnail, uploadProductIcon, uploadProductWireframe } from '@/lib/imageUpload';
import type { Product, PerfRow, ProductSeries } from '@/lib/products';
import { createEmptyProduct, getSeriesLabel, getDefaultTag, getCategoryFromSeries, getDefaultSegments, getSegments, SEGMENT_OPTIONS } from '@/lib/products';
import type { ProductCategory } from '@/lib/products';

// Segments as shown in the form: an explicit (possibly empty) array wins over the fallback
const formSegments = (p: { series: string; segments?: string[] }): string[] =>
  Array.isArray(p.segments) ? p.segments : getSegments(p);

interface ProductFormModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const { create, update } = useProductActions();
  const { series: seriesList } = useSeries();

  const [formData, setFormData] = useState<Product>(
    product ?? { ...createEmptyProduct('haemng'), category: getCategoryFromSeries('haemng') }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [wireframeFile, setWireframeFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [wireframePreview, setWireframePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ step: string; total: number; current: number } | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const wireframeInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when editing existing product
  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        category: product.category ?? getCategoryFromSeries(product.series),
        segments: getSegments(product),
      });
      if (product.thumbnailUrl) setThumbnailPreview(product.thumbnailUrl);
      if (product.iconUrl) setIconPreview(product.iconUrl);
      if (product.wireframeUrl) setWireframePreview(product.wireframeUrl);
    } else {
      // Only pick the default series while the form is still pristine (series list may load late)
      setFormData(prev => {
        const defaultSeries = seriesList[0]?.id || 'haemng';
        if (prev.id || prev.model) return prev;
        return { ...createEmptyProduct(defaultSeries), category: getCategoryFromSeries(defaultSeries) };
      });
    }
  }, [product, seriesList]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSaving, onClose]);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, [errors]);

  // Series change - update related fields
  const handleSeriesChange = useCallback((series: ProductSeries) => {
    const selectedSeries = seriesList.find(s => s.id === series);
    setFormData(prev => {
      // Keep the user's segment choice unless it is still the default of the old series
      const prevSegs = formSegments(prev);
      const isDefault = prevSegs.join() === getDefaultSegments(prev.series).join();
      return {
        ...prev,
        series,
        seriesLabel: selectedSeries?.label || getSeriesLabel(series),
        tag: getDefaultTag(selectedSeries?.id ?? series),
        category: getCategoryFromSeries(series),
        segments: isDefault ? getDefaultSegments(series) : prevSegs,
      };
    });
  }, [seriesList]);

  const toggleSegment = useCallback((segmentId: string) => {
    setFormData(prev => {
      const current = formSegments(prev);
      const next = current.includes(segmentId)
        ? current.filter(x => x !== segmentId)
        : [...current, segmentId];
      // keep canonical order
      const ordered = SEGMENT_OPTIONS.map(o => o.id as string).filter(x => next.includes(x));
      return { ...prev, segments: ordered };
    });
    setErrors(prev => { const n = { ...prev }; delete n.segments; return n; });
  }, []);

  // Handle thumbnail file selection
  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
    setErrors(prev => { const n = { ...prev }; delete n.thumbnail; return n; });
  };

  // Handle icon file selection
  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setErrors(prev => { const n = { ...prev }; delete n.icon; return n; });
  };

  // Handle wireframe file selection
  const handleWireframeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWireframeFile(file);
    setWireframePreview(URL.createObjectURL(file));
    setErrors(prev => { const n = { ...prev }; delete n.wireframe; return n; });
  };

  // Generate unique product ID
  const generateProductId = (): string => {
    const model = formData.model || '';
    const prefix = formData.series;
    const slug = model
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = crypto.randomUUID().slice(0, 6);
    return [prefix, slug, suffix].filter(Boolean).join('-');
  };

  // KeySpecs management
  const updateKeySpec = useCallback((index: number, field: 'label' | 'value', value: string) => {
    setFormData(prev => {
      const newKeySpecs = [...(prev.keySpecs || [])];
      newKeySpecs[index] = { ...newKeySpecs[index], [field]: value };
      return { ...prev, keySpecs: newKeySpecs };
    });
  }, []);

  const addKeySpec = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      keySpecs: [...(prev.keySpecs || []), { label: '', value: '' }],
    }));
  }, []);

  const removeKeySpec = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      keySpecs: (prev.keySpecs || []).filter((_, i) => i !== index),
    }));
  }, []);

  // AllSpecs management
  const updateAllSpec = useCallback((index: number, field: 'label' | 'value', value: string) => {
    setFormData(prev => {
      const newAllSpecs = [...(prev.allSpecs || [])];
      newAllSpecs[index] = { ...newAllSpecs[index], [field]: value };
      return { ...prev, allSpecs: newAllSpecs };
    });
  }, []);

  const addAllSpec = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      allSpecs: [...(prev.allSpecs || []), { label: '', value: '' }],
    }));
  }, []);

  const removeAllSpec = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      allSpecs: (prev.allSpecs || []).filter((_, i) => i !== index),
    }));
  }, []);

  // Performance data (perf) management
  const updatePerfRow = useCallback((index: number, field: keyof PerfRow, value: string) => {
    setFormData(prev => {
      const newPerf = [...(prev.perf || [])];
      newPerf[index] = { ...newPerf[index], [field]: value };
      return { ...prev, perf: newPerf };
    });
  }, []);

  const addPerfRow = useCallback(() => {
    const perf = formData.perf || [];
    const lastThrottle = perf.length > 0
      ? parseInt(perf[perf.length - 1].throttle) + 5
      : 30;
    const newRow: PerfRow = {
      throttle: `${Math.min(lastThrottle, 100)}%`,
      voltage: '',
      current: '',
      power: '',
      thrust: '',
      speed: '',
      efficiency: '',
    };
    setFormData(prev => ({
      ...prev,
      perf: [...(prev.perf || []), newRow],
    }));
  }, [formData.perf]);

  const removePerfRow = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      perf: (prev.perf || []).filter((_, i) => i !== index),
    }));
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.model?.trim()) newErrors.model = 'Model name is required';
    if (!formData.id?.trim()) newErrors.id = 'Product ID is required';

    if (formSegments(formData).length === 0) {
      newErrors.segments = 'Select at least one segment';
    }

    // Validate keySpecs have values
    const emptyKeySpecs = formData.keySpecs?.filter(s => !s.value?.trim() && s.label?.trim());
    if (emptyKeySpecs?.length > 0) {
      newErrors.keySpecs = 'Some key specs have labels but no values';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setUploadProgress(null);

    const steps = ['thumbnail', 'icon', 'wireframe', 'save'].filter(s => {
      if (s === 'thumbnail') return !!thumbnailFile;
      if (s === 'icon') return !!iconFile;
      if (s === 'wireframe') return !!wireframeFile;
      return true;
    });
    let stepIndex = 0;

    const advance = (step: string) => {
      stepIndex++;
      setUploadProgress({ step, total: steps.length, current: stepIndex });
    };

    try {
      const productId = formData.id?.trim() || generateProductId();
      let thumbnailUrl = formData.thumbnailUrl;
      let iconUrl = formData.iconUrl;
      let wireframeUrl = formData.wireframeUrl;

      if (thumbnailFile) {
        advance('Uploading thumbnail…');
        const result = await uploadProductThumbnail(thumbnailFile, productId);
        if (!result.success) {
          setErrors({ thumbnail: result.error || 'Failed to upload thumbnail' });
          return;
        }
        thumbnailUrl = result.url;
      }

      if (iconFile) {
        advance('Uploading icon…');
        const result = await uploadProductIcon(iconFile, productId);
        if (!result.success) {
          setErrors({ icon: result.error || 'Failed to upload icon' });
          return;
        }
        iconUrl = result.url;
      }

      if (wireframeFile) {
        advance('Uploading wireframe…');
        const result = await uploadProductWireframe(wireframeFile, productId);
        if (!result.success) {
          setErrors({ wireframe: result.error || 'Failed to upload wireframe' });
          return;
        }
        wireframeUrl = result.url;
      }

      advance('Saving product…');

      const finalData: Product = {
        ...formData,
        id: productId,
        segments: formSegments(formData),
        thumbnailUrl,
        iconUrl,
        wireframeUrl,
      };

      const success = product
        ? await update(product.id, finalData)
        : await create(finalData, saveAsDraft);

      if (success) onClose();
      else setErrors({ general: 'Failed to save product. Please try again.' });
    } catch (err) {
      console.error('Error saving product:', err);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const inputClass = (field: string) => `input${errors[field] ? ' input-error' : ''}`;

  return (
    <div className="modal-overlay" onClick={!isSaving ? onClose : undefined} role="dialog" aria-modal="true">
      <div className="modal product-modal" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} noValidate>

          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-left">
              <span className="modal-eyebrow">{product ? 'Editing' : 'New'}</span>
              <h2 className="modal-title">{product ? 'Edit Product' : 'Add Product'}</h2>
            </div>
            <button type="button" className="modal-close" onClick={onClose} disabled={isSaving}>
              ×
            </button>
          </div>

          {/* Body */}
          <div className="modal-body">

            {errors.general && (
              <div className="alert alert-error" role="alert">
                <span>{errors.general}</span>
              </div>
            )}

            {/* Section: Identity */}
            <fieldset className="form-section" disabled={isSaving}>
              <legend className="section-label">Identity</legend>
              <div className="form-grid">

                <div className="form-group full-width">
                  <label htmlFor="model" className="label">Model Name *</label>
                  <input
                    id="model"
                    type="text"
                    className={inputClass('model')}
                    value={formData.model || ''}
                    onChange={e => handleChange('model', e.target.value)}
                    placeholder="e.g., HAEMNG 2121 II"
                    autoFocus={!product}
                  />
                  {errors.model && <div className="field-error">{errors.model}</div>}
                </div>

                <div className="form-group form-group-wide">
                  <label htmlFor="id" className="label">
                    Product ID *
                    {product && <span className="label-badge">read-only</span>}
                  </label>
                  <div className="input-row">
                    <input
                      id="id"
                      type="text"
                      className={inputClass('id')}
                      value={formData.id || ''}
                      onChange={e => handleChange('id', e.target.value)}
                      placeholder="e.g., haemng-2121-ii"
                      readOnly={!!product}
                      style={product ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    />
                    {!product && (
                      <button
                        type="button"
                        className="btn-generate"
                        onClick={() => handleChange('id', generateProductId())}
                        title="Auto-generate unique ID"
                      >
                        ⚡ Generate
                      </button>
                    )}
                  </div>
                  {errors.id && <div className="field-error">{errors.id}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="series" className="label">Series</label>
                  <select
                    id="series"
                    className="select"
                    value={formData.series}
                    onChange={e => handleSeriesChange(e.target.value as ProductSeries)}
                  >
                    {seriesList.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="category" className="label">Category</label>
                  <select
                    id="category"
                    className="select"
                    value={formData.category ?? getCategoryFromSeries(formData.series)}
                    onChange={e => handleChange('category', e.target.value as ProductCategory)}
                  >
                    <option value="motor">Motor</option>
                    <option value="esc">ESC</option>
                    <option value="fc">Flight Controller</option>
                    <option value="ips">IPS</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Segments</label>
                  <div role="group" aria-label="Segments" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                    {SEGMENT_OPTIONS.map(opt => (
                      <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formSegments(formData).includes(opt.id)}
                          onChange={() => toggleSegment(opt.id)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.segments && <div className="field-error">{errors.segments}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="name" className="label">Display Name</label>
                  <input
                    id="name"
                    type="text"
                    className="input"
                    value={formData.name || ''}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="e.g., HAEMNG 2121 II"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="application" className="label">Application</label>
                  <input
                    id="application"
                    type="text"
                    className="input"
                    value={formData.application || ''}
                    onChange={e => handleChange('application', e.target.value)}
                    placeholder="e.g., UAV / eVTOL"
                  />
                </div>

              </div>
            </fieldset>

            {/* Section: Key Specs (displayed on cards) */}
            <fieldset className="form-section" disabled={isSaving}>
              <div className="section-header-row">
                <legend className="section-label">Key Specs (Card Display)</legend>
                <button type="button" className="btn-add-field" onClick={addKeySpec}>
                  + Add Spec
                </button>
              </div>

              <div className="specs-list">
                {(formData.keySpecs || [{ label: '', value: '' }]).map((spec, index) => (
                  <div key={index} className="spec-row">
                    <input
                      type="text"
                      placeholder="Label (e.g., KV Rating)"
                      value={spec.label}
                      onChange={e => updateKeySpec(index, 'label', e.target.value)}
                      className="input spec-label"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g., 380)"
                      value={spec.value}
                      onChange={e => updateKeySpec(index, 'value', e.target.value)}
                      className="input spec-value"
                    />
                    {(formData.keySpecs?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKeySpec(index)}
                        className="btn-remove-field"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.keySpecs && <div className="field-error">{errors.keySpecs}</div>}
            </fieldset>

            {/* Section: All Specs (full specifications) */}
            <fieldset className="form-section" disabled={isSaving}>
              <div className="section-header-row">
                <legend className="section-label">Full Specifications</legend>
                <button type="button" className="btn-add-field" onClick={addAllSpec}>
                  + Add Spec
                </button>
              </div>

              <div className="specs-list">
                {(formData.allSpecs || []).map((spec, index) => (
                  <div key={index} className="spec-row">
                    <input
                      type="text"
                      placeholder="Label"
                      value={spec.label}
                      onChange={e => updateAllSpec(index, 'label', e.target.value)}
                      className="input spec-label"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={spec.value}
                      onChange={e => updateAllSpec(index, 'value', e.target.value)}
                      className="input spec-value"
                    />
                    <button
                      type="button"
                      onClick={() => removeAllSpec(index)}
                      className="btn-remove-field"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {(formData.allSpecs?.length || 0) === 0 && (
                <p className="help-text">Add detailed specifications for the product detail page</p>
              )}
            </fieldset>

            {/* Section: Performance Data (optional for any product) */}
            <fieldset className="form-section" disabled={isSaving}>
              <div className="section-header-row">
                <legend className="section-label">Performance Data (Bench Test)</legend>
                <button type="button" className="btn-add-field" onClick={addPerfRow}>
                  + Add Row
                </button>
              </div>

                <div className="perf-table">
                  {(formData.perf || []).map((row, index) => (
                    <div key={index} className="perf-row">
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="30%"
                          value={row.throttle}
                          onChange={e => updatePerfRow(index, 'throttle', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Throttle</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="24.94 V"
                          value={row.voltage}
                          onChange={e => updatePerfRow(index, 'voltage', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Voltage</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="0.40 A"
                          value={row.current}
                          onChange={e => updatePerfRow(index, 'current', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Current</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="9.93 W"
                          value={row.power}
                          onChange={e => updatePerfRow(index, 'power', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Power</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="151 g"
                          value={row.thrust}
                          onChange={e => updatePerfRow(index, 'thrust', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Thrust</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="2,493 RPM"
                          value={row.speed || ''}
                          onChange={e => updatePerfRow(index, 'speed', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Speed</span>
                      </div>
                      <div className="perf-cell">
                        <input
                          type="text"
                          placeholder="15.21 g/W"
                          value={row.efficiency || ''}
                          onChange={e => updatePerfRow(index, 'efficiency', e.target.value)}
                          className="input perf-input"
                        />
                        <span className="perf-label">Efficiency</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePerfRow(index)}
                        className="btn-remove-field"
                        title="Remove row"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {(formData.perf?.length || 0) === 0 && (
                  <p className="help-text">Add performance bench test data (throttle curves, thrust, efficiency)</p>
                )}
              </fieldset>

            {/* Section: Images */}
            <fieldset className="form-section" disabled={isSaving}>
              <legend className="section-label">Product Images</legend>
              <div className="images-row">

                {/* Thumbnail */}
                <div className="image-upload-card">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`image-drop-zone${thumbnailPreview ? ' has-image' : ''}`}
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="Thumbnail" className="drop-preview-img" />
                    ) : (
                      <div className="drop-placeholder">
                        <span className="drop-hint">Click to upload thumbnail</span>
                      </div>
                    )}
                    <div className="drop-overlay">
                      <span>{thumbnailPreview ? 'Change' : 'Upload'}</span>
                    </div>
                  </div>
                  <div className="image-card-meta">
                    <span className="image-card-title">Thumbnail</span>
                    <span className="image-card-spec">800 × 600 px</span>
                  </div>

                  {/* Background Color */}
                  <div className="color-picker-group">
                    <label className="field-label">Background Color</label>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={formData.thumbnailBgColor || '#111111'}
                        onChange={e => handleChange('thumbnailBgColor', e.target.value)}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={formData.thumbnailBgColor || '#111111'}
                        onChange={e => handleChange('thumbnailBgColor', e.target.value)}
                        className="input input-sm"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Icon */}
                <div className="image-upload-card image-upload-card--small">
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`image-drop-zone${iconPreview ? ' has-image' : ''}`}
                    onClick={() => iconInputRef.current?.click()}
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Icon" className="drop-preview-img" />
                    ) : (
                      <div className="drop-placeholder">
                        <span className="drop-hint">Click to upload icon</span>
                      </div>
                    )}
                    <div className="drop-overlay">
                      <span>{iconPreview ? 'Change' : 'Upload'}</span>
                    </div>
                  </div>
                  <div className="image-card-meta">
                    <span className="image-card-title">Icon</span>
                    <span className="image-card-spec">256 × 256 px</span>
                  </div>
                </div>

                {/* Wireframe */}
                <div className="image-upload-card">
                  <input
                    ref={wireframeInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleWireframeSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`image-drop-zone${wireframePreview ? ' has-image' : ''}`}
                    onClick={() => wireframeInputRef.current?.click()}
                  >
                    {wireframePreview ? (
                      <img src={wireframePreview} alt="Wireframe" className="drop-preview-img" />
                    ) : (
                      <div className="drop-placeholder">
                        <span className="drop-hint">Click to upload wireframe</span>
                      </div>
                    )}
                    <div className="drop-overlay">
                      <span>{wireframePreview ? 'Change' : 'Upload'}</span>
                    </div>
                  </div>
                  <div className="image-card-meta">
                    <span className="image-card-title">Wireframe</span>
                    <span className="image-card-spec">SVG/PNG recommended</span>
                  </div>
                </div>

              </div>
            </fieldset>

          </div>

          {/* Footer */}
          <div className="modal-footer">
            {uploadProgress && (
              <div className="progress-wrap">
                <span className="progress-label">{uploadProgress.step}</span>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            {!product && (
              <button
                type="button"
                className="btn btn-draft"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save as Draft'}
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : product ? 'Update' : 'Publish'}
            </button>
          </div>

          <style jsx>{`
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(14, 14, 15, 0.65);
              backdrop-filter: blur(2px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              padding: 20px;
            }

            .product-modal {
              max-width: 800px;
              width: 100%;
              max-height: 92vh;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
            }

            .modal-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 20px 24px;
              border-bottom: 1px solid var(--color-white-border);
              position: sticky;
              top: 0;
              background: var(--color-white-pure);
              z-index: 10;
            }

            .modal-header-left {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .modal-eyebrow {
              font-family: var(--font-mono);
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: var(--color-gold);
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
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: transparent;
              border: 1px solid transparent;
              cursor: pointer;
              color: var(--color-ink-soft);
              border-radius: 4px;
              font-size: 20px;
            }
            .modal-close:hover { background: var(--color-white-grey); color: var(--color-ink); }
            .modal-close:disabled { opacity: 0.4; cursor: not-allowed; }

            .modal-body {
              padding: 24px;
              flex: 1;
              overflow-y: auto;
            }

            .form-section {
              margin-bottom: 28px;
              border: none;
              padding: 0;
            }

            .section-label {
              font-family: var(--font-mono);
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: var(--color-ink-soft);
              display: block;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--color-white-border);
            }

            .section-header-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--color-white-border);
            }

            .form-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
            }

            .form-group {
              display: flex;
              flex-direction: column;
            }
            .form-group.full-width { grid-column: 1 / -1; }
            .form-group.form-group-wide { grid-column: span 2; }

            .label {
              font-family: var(--font-mono);
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.04em;
              color: var(--color-ink-soft);
              margin-bottom: 6px;
              display: flex;
              align-items: center;
              gap: 6px;
            }

            .label-badge {
              font-size: 9px;
              padding: 1px 5px;
              background: var(--color-white-grey);
              border: 1px solid var(--color-white-border);
              border-radius: 3px;
              color: var(--color-ink-soft);
              text-transform: uppercase;
            }

            .input-row {
              display: flex;
              gap: 8px;
            }
            .input-row .input { flex: 1; }

            .btn-generate {
              padding: 0 12px;
              height: 36px;
              background: var(--color-gold);
              border: 1px solid var(--color-gold);
              border-radius: 4px;
              color: var(--color-ink);
              font-family: var(--font-mono);
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
            }
            .btn-generate:hover { filter: brightness(1.1); }

            .field-error {
              font-family: var(--font-mono);
              font-size: 11px;
              color: var(--color-error);
              margin-top: 4px;
            }

            .btn-add-field {
              display: flex;
              align-items: center;
              gap: 5px;
              padding: 5px 10px;
              background: transparent;
              border: 1px solid var(--color-white-border);
              border-radius: 4px;
              color: var(--color-ink-soft);
              font-family: var(--font-mono);
              font-size: 11px;
              cursor: pointer;
            }
            .btn-add-field:hover { border-color: var(--color-gold); color: var(--color-ink); }

            .specs-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .spec-row {
              display: flex;
              gap: 8px;
              align-items: center;
            }
            .spec-label { flex: 0 0 35%; }
            .spec-value { flex: 1; }

            .btn-remove-field {
              width: 32px;
              height: 32px;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              border: 1px solid var(--color-white-border);
              border-radius: 4px;
              color: var(--color-ink-soft);
              cursor: pointer;
              font-size: 16px;
            }
            .btn-remove-field:hover { background: var(--color-error); border-color: var(--color-error); color: white; }

            .help-text {
              font-family: var(--font-mono);
              font-size: 11px;
              color: var(--color-ink-soft);
              margin: 0;
              font-style: italic;
            }

            /* Performance table */
            .perf-table {
              display: flex;
              flex-direction: column;
              gap: 8px;
              overflow-x: auto;
            }

            .perf-row {
              display: flex;
              gap: 6px;
              align-items: center;
              min-width: 700px;
            }

            .perf-cell {
              display: flex;
              flex-direction: column;
              gap: 2px;
              flex: 1;
            }

            .perf-input {
              padding: 8px 10px;
              font-size: 12px;
            }

            .perf-label {
              font-family: var(--font-mono);
              font-size: 9px;
              color: var(--color-ink-soft);
              text-transform: uppercase;
            }

            /* Images */
            .images-row {
              display: flex;
              gap: 16px;
              align-items: flex-start;
              flex-wrap: wrap;
            }

            .image-upload-card {
              display: flex;
              flex-direction: column;
              gap: 8px;
              flex: 1;
              min-width: 160px;
            }
            .image-upload-card--small { max-width: 160px; }

            .image-drop-zone {
              position: relative;
              border: 2px dashed var(--color-white-border);
              border-radius: 6px;
              overflow: hidden;
              cursor: pointer;
              aspect-ratio: 4/3;
              background: var(--color-white-warm);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .image-upload-card--small .image-drop-zone { aspect-ratio: 1; }
            .image-drop-zone:hover { border-color: var(--color-gold); }

            .drop-placeholder {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
              color: var(--color-ink-soft);
            }

            .drop-hint {
              font-family: var(--font-mono);
              font-size: 11px;
            }

            .drop-preview-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .drop-overlay {
              position: absolute;
              inset: 0;
              background: rgba(14, 14, 15, 0.55);
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 0;
              font-family: var(--font-mono);
              font-size: 12px;
              color: white;
            }
            .image-drop-zone:hover .drop-overlay { opacity: 1; }

            .image-card-meta {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .image-card-title {
              font-family: var(--font-mono);
              font-size: 11px;
              font-weight: 600;
              color: var(--color-ink);
            }

            .image-card-spec {
              font-family: var(--font-mono);
              font-size: 10px;
              color: var(--color-ink-soft);
            }

            .color-picker-group {
              margin-top: 12px;
            }

            .color-picker-row {
              display: flex;
              gap: 8px;
              align-items: center;
            }

            .color-input {
              width: 40px;
              height: 32px;
              border: 1px solid var(--color-white-border);
              border-radius: 4px;
              cursor: pointer;
              padding: 2px;
            }

            .input-sm {
              padding: 6px 10px;
              font-size: 12px;
              width: 80px;
            }

            /* Footer */
            .modal-footer {
              display: flex;
              flex-direction: column;
              gap: 12px;
              padding: 16px 24px;
              border-top: 1px solid var(--color-white-border);
              background: var(--color-white-warm);
              position: sticky;
              bottom: 0;
            }

            .progress-wrap {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .progress-label {
              font-family: var(--font-mono);
              font-size: 11px;
              color: var(--color-ink-soft);
            }

            .progress-bar-track {
              flex: 1;
              height: 4px;
              background: var(--color-white-border);
              border-radius: 2px;
            }

            .progress-bar-fill {
              height: 100%;
              background: var(--color-gold);
              border-radius: 2px;
              transition: width 300ms ease;
            }

            .btn-draft {
              background: transparent;
              color: var(--color-ink);
              border: 1px solid var(--color-white-border);
            }
            .btn-draft:hover {
              border-color: var(--color-gold);
              color: var(--color-gold);
            }

            fieldset:disabled { opacity: 0.6; pointer-events: none; }
          `}</style>
        </form>
      </div>
    </div>
  );
}