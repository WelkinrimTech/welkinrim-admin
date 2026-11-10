'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { useSeries } from '@/hooks/useSeries';
import { useEnquiries } from '@/hooks/useEnquiries';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

interface StorageStats {
  bucket_name: string;
  file_count: number;
  total_size: number;
}

export default function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const { products, refresh: refreshProducts } = useProducts();
  const { series, refresh: refreshSeries } = useSeries();
  const { stats: enquiryStats, refresh: refreshEnquiries } = useEnquiries();
  const [isLoaded, setIsLoaded] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingStorage, setLoadingStorage] = useState(true);

  // `loadingActivity` starts true, so it is not re-raised here (effect runs on mount)
  // Get recent products as activity proxy
  const fetchRecentActivity = () => supabase
    .from('products')
    .select('id, model, name, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  const applyRecentActivity = ({ data: recentProducts }: Awaited<ReturnType<typeof fetchRecentActivity>>) => {
    if (recentProducts) {
      const activity: ActivityLog[] = recentProducts.map(p => ({
        id: p.id,
        action: 'updated',
        entity_type: 'product',
        entity_id: p.id,
        entity_name: p.name || p.model,
        user_id: '',
        user_name: 'System',
        created_at: p.updated_at || p.created_at,
      }));
      setRecentActivity(activity);
    }
    setLoadingActivity(false);
  };

  // `loadingStorage` starts true, so it is not re-raised here (effect runs on mount)
  const fetchStorageStats = async (): Promise<StorageStats[] | null> => {
    try {
      const buckets = ['product-icons', 'product-images'];
      const stats: StorageStats[] = [];

      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list();
        if (files) {
          stats.push({
            bucket_name: bucket,
            file_count: files.length,
            total_size: files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0),
          });
        }
      }

      return stats;
    } catch (e) {
      console.error('Failed to load storage stats:', e);
      return null;
    }
  };

  const applyStorageStats = (stats: StorageStats[] | null) => {
    if (stats) setStorageStats(stats);
    setLoadingStorage(false);
  };

  useEffect(() => {
    refreshProducts();
    refreshSeries();
    refreshEnquiries();
    void fetchRecentActivity().then(applyRecentActivity);
    void fetchStorageStats().then(applyStorageStats);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate: render nothing until the first client effect has run
    setIsLoaded(true);
  }, [refreshProducts, refreshSeries, refreshEnquiries]);

  if (!isLoaded || !products) {
    return null;
  }

  // Calculate stats
  const stats = {
    totalProducts: products.length || 0,
    publishedProducts: products.filter(p => p.is_published).length || 0,
    draftProducts: products.filter(p => !p.is_published && !p.is_deleted).length || 0,
    trashProducts: products.filter(p => p.is_deleted).length || 0,
    motors: products.filter(p => p.category === 'motor').length || 0,
    escs: products.filter(p => p.category === 'esc').length || 0,
    fcs: products.filter(p => p.category === 'fc').length || 0,
    ips: products.filter(p => p.category === 'ips').length || 0,
    totalSeries: series.length || 0,
    haemngMotors: products.filter(p => p.series === 'haemng').length || 0,
    maelardMotors: products.filter(p => p.series === 'maelard').length || 0,
  };

  // Category distribution
  const categoryDistribution = [
    { name: 'Motors', count: stats.motors, color: '#E8A800', percent: Math.round((stats.motors / stats.totalProducts) * 100) || 0 },
    { name: 'ESCs', count: stats.escs, color: '#2B7FE8', percent: Math.round((stats.escs / stats.totalProducts) * 100) || 0 },
    { name: 'FCs', count: stats.fcs, color: '#7B5CD4', percent: Math.round((stats.fcs / stats.totalProducts) * 100) || 0 },
    { name: 'IPS', count: stats.ips, color: '#3BB88B', percent: Math.round((stats.ips / stats.totalProducts) * 100) || 0 },
  ];

  // Quick actions
  const quickActions = [
    { href: '/enquiries', label: 'Enquiries', icon: EnquiriesIcon, description: `${enquiryStats.new} new`, highlight: enquiryStats.new > 0 },
    { href: '/products', label: 'Products', icon: ProductsIcon, description: `${stats.totalProducts} items` },
    { href: '/series', label: 'Series', icon: SeriesIcon, description: `${stats.totalSeries} series` },
    { href: '/drafts', label: 'Drafts', icon: DraftsIcon, description: `${stats.draftProducts} drafts`, highlight: stats.draftProducts > 0 },
    { href: '/storage', label: 'Storage', icon: StorageIcon, description: 'Manage files' },
    { href: '/settings', label: 'Settings', icon: SettingsIcon, description: 'Account & preferences' },
  ];

  // Super admin quick actions
  const adminActions = isSuperAdmin ? [
    { label: 'Invite Admin', icon: InviteIcon, description: 'Add new admin user', onClick: () => window.location.href = '/settings' },
  ] : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.name || 'Admin'}
            {isSuperAdmin && <span className="super-badge">SUPER ADMIN</span>}
          </p>
        </div>
        <div className="header-time">
          <span className="time-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="stats-main">
        <div className="stat-card main-stat">
          <div className="stat-header">
            <span className="stat-label">Total Products</span>
            <Link href="/products" className="stat-link">View All →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value large">{stats.totalProducts}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item published">{stats.publishedProducts} published</span>
              <span className="breakdown-item draft">{stats.draftProducts} drafts</span>
              {stats.trashProducts > 0 && <span className="breakdown-item trash">{stats.trashProducts} in trash</span>}
            </div>
          </div>
        </div>

        <div className={`stat-card ${enquiryStats.new > 0 ? 'highlight-stat' : ''}`}>
          <div className="stat-header">
            <span className="stat-label">New Enquiries</span>
            <Link href="/enquiries" className="stat-link">View All →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{enquiryStats.new}</span>
            <div className="stat-breakdown">
              {enquiryStats.new > 0 && <span className="breakdown-item highlight">{enquiryStats.new} unread</span>}
              {enquiryStats.responded > 0 && <span className="breakdown-item">{enquiryStats.responded} responded</span>}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Product Series</span>
            <Link href="/series" className="stat-link">Manage →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.totalSeries}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">Haemng: {stats.haemngMotors}</span>
              <span className="breakdown-item">Maelard: {stats.maelardMotors}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Storage</span>
            <Link href="/storage" className="stat-link">Manage →</Link>
          </div>
          <div className="stat-body">
            {loadingStorage ? (
              <span className="stat-loading">Loading...</span>
            ) : (
              <>
                <span className="stat-value">{storageStats.reduce((sum, s) => sum + s.file_count, 0)}</span>
                <span className="stat-unit">files</span>
                <div className="stat-breakdown">
                  {storageStats.map(s => (
                    <span key={s.bucket_name} className="breakdown-item">{s.bucket_name}: {s.file_count}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Published</span>
            <span className="stat-percent">{Math.round((stats.publishedProducts / stats.totalProducts) * 100) || 0}%</span>
          </div>
          <div className="stat-body">
            <div className="publish-progress">
              <div className="publish-bar" style={{ width: `${Math.round((stats.publishedProducts / stats.totalProducts) * 100) || 0}%` }} />
            </div>
            <div className="stat-breakdown">
              <span className="breakdown-item">{stats.publishedProducts} of {stats.totalProducts} products</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="stats-secondary">
        <div className="stat-card compact">
          <div className="stat-header">
            <span className="stat-label">Total Enquiries</span>
            <Link href="/enquiries" className="stat-link">View →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{enquiryStats.total}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">{enquiryStats.resolved} resolved</span>
              {enquiryStats.spam > 0 && <span className="breakdown-item">{enquiryStats.spam} spam</span>}
            </div>
          </div>
        </div>

        <div className="stat-card compact">
          <div className="stat-header">
            <span className="stat-label">Motors</span>
            <Link href="/products#haemng" className="stat-link">View →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.motors}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">{stats.haemngMotors} Haemng</span>
              <span className="breakdown-item">{stats.maelardMotors} Maelard</span>
            </div>
          </div>
        </div>

        <div className="stat-card compact">
          <div className="stat-header">
            <span className="stat-label">Drafts</span>
            <Link href="/drafts" className="stat-link">Edit →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.draftProducts}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">Unpublished products</span>
            </div>
          </div>
        </div>

        <div className="stat-card compact">
          <div className="stat-header">
            <span className="stat-label">ESCs & Controllers</span>
            <Link href="/products#esc" className="stat-link">View →</Link>
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.escs + stats.fcs}</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">{stats.escs} ESCs</span>
              <span className="breakdown-item">{stats.fcs} Controllers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="dashboard-section">
        <h2 className="section-title">Category Distribution</h2>
        <div className="category-bars">
          {categoryDistribution.map(cat => (
            <div key={cat.name} className="category-row">
              <div className="category-info">
                <span className="category-name">{cat.name}</span>
                <span className="category-count">{cat.count} products</span>
              </div>
              <div className="category-bar-container">
                <div className="category-bar" style={{ width: `${cat.percent}%`, background: cat.color }} />
              </div>
              <span className="category-percent">{cat.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions-grid">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href} className={`quick-action-card ${action.highlight ? 'highlight' : ''}`}>
              <div className="action-icon"><action.icon /></div>
              <div className="action-info">
                <span className="action-label">{action.label}</span>
                <span className="action-desc">{action.description}</span>
              </div>
            </Link>
          ))}
          {adminActions.map(action => (
            <button key={action.label} className="quick-action-card admin-action" onClick={action.onClick}>
              <div className="action-icon"><action.icon /></div>
              <div className="action-info">
                <span className="action-label">{action.label}</span>
                <span className="action-desc">{action.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-columns">
        {/* Recent Activity */}
        <div className="dashboard-section column">
          <h2 className="section-title">Recent Activity</h2>
          {loadingActivity ? (
            <div className="loading-placeholder">Loading activity...</div>
          ) : recentActivity.length === 0 ? (
            <div className="empty-state">No recent activity</div>
          ) : (
            <div className="activity-list">
              {recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-content">
                    <span className="activity-text">
                      <strong>{activity.entity_name}</strong> was {activity.action}
                    </span>
                    <span className="activity-time">{formatDate(activity.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="dashboard-section column">
          <h2 className="section-title">System Status</h2>
          <div className="system-status-list">
            <div className="status-item success">
              <div className="status-indicator success" />
              <div className="status-content">
                <span className="status-label">Database</span>
                <span className="status-value">Connected</span>
              </div>
            </div>
            <div className="status-item success">
              <div className="status-indicator success" />
              <div className="status-content">
                <span className="status-label">Authentication</span>
                <span className="status-value">Active</span>
              </div>
            </div>
            <div className="status-item success">
              <div className="status-indicator success" />
              <div className="status-content">
                <span className="status-label">Storage</span>
                <span className="status-value">{storageStats.length} buckets active</span>
              </div>
            </div>
            <div className="status-item">
              <div className="status-indicator info" />
              <div className="status-content">
                <span className="status-label">Session</span>
                <span className="status-value">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Website Links */}
      <div className="dashboard-section">
        <h2 className="section-title">Quick Links</h2>
        <div className="links-grid">
          <a href="https://www.welkinrim.com" target="_blank" rel="noopener noreferrer" className="link-card primary">
            <span className="link-label">Primary Website</span>
            <span className="link-url">www.welkinrim.com</span>
            <span className="link-arrow">↗</span>
          </a>
          <a href="https://welkinrim-tech-one.vercel.app" target="_blank" rel="noopener noreferrer" className="link-card">
            <span className="link-label">Secondary Website</span>
            <span className="link-url">welkinrim-tech-one.vercel.app</span>
            <span className="link-arrow">↗</span>
          </a>
          <a href="https://supabase.com/dashboard/project/axjomaehmyohlnbyekjr" target="_blank" rel="noopener noreferrer" className="link-card">
            <span className="link-label">Supabase Dashboard</span>
            <span className="link-url">Manage backend</span>
            <span className="link-arrow">↗</span>
          </a>
        </div>
      </div>

      <style jsx>{`
        .dashboard-page {
          padding: 24px;
          max-width: 1400px;
        }

        .dashboard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 32px;
        }

        .dashboard-title {
          font-family: var(--font-display);
          font-size: 32px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin: 0 0 8px 0;
        }

        .dashboard-subtitle {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-ink-mid);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .super-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: var(--color-gold);
          color: var(--color-ink);
          padding: 4px 8px;
          border-radius: 3px;
        }

        .header-time {
          text-align: right;
        }

        .time-label {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink-soft);
        }

        /* Main Stats */
        .stats-main {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stats-secondary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 20px;
        }

        .main-stat {
          border-color: var(--color-gold);
          border-width: 2px;
        }

        .highlight-stat {
          border-color: var(--color-gold);
          border-width: 2px;
          background: rgba(232, 168, 0, 0.03);
        }

        .stat-card.compact {
          padding: 16px;
        }

        .stat-card.compact .stat-value {
          font-size: 24px;
        }

        .stat-card.compact .stat-header {
          margin-bottom: 12px;
        }

        .stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .stat-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .stat-link {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--color-gold);
          text-decoration: none;
          transition: opacity 150ms;
        }

        .stat-link:hover {
          opacity: 0.7;
        }

        .stat-percent {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          color: var(--color-gold);
        }

        .stat-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: var(--color-ink);
        }

        .stat-value.large {
          font-size: 36px;
        }

        .stat-unit {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .stat-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .breakdown-item {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-mid);
          background: var(--color-white-grey);
          padding: 4px 8px;
          border-radius: 3px;
        }

        .breakdown-item.published {
          background: #f0fdf4;
          color: #166534;
        }

        .breakdown-item.draft {
          background: #fef3c7;
          color: #92400e;
        }

        .breakdown-item.trash {
          background: #fef2f2;
          color: #991b1b;
        }

        .breakdown-item.highlight {
          background: var(--color-gold);
          color: var(--color-ink);
          font-weight: 700;
        }

        .stat-loading {
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--color-ink-soft);
        }

        .publish-progress {
          height: 12px;
          background: var(--color-white-grey);
          border-radius: 6px;
          overflow: hidden;
        }

        .publish-bar {
          height: 100%;
          background: var(--color-gold);
          border-radius: 6px;
          transition: width 300ms ease;
        }

        /* Section */
        .dashboard-section {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 14px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin: 0 0 20px 0;
        }

        /* Category Distribution */
        .category-bars {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .category-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .category-info {
          display: flex;
          flex-direction: column;
          min-width: 100px;
        }

        .category-name {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .category-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        .category-bar-container {
          flex: 1;
          height: 8px;
          background: var(--color-white-grey);
          border-radius: 4px;
          overflow: hidden;
        }

        .category-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 300ms ease;
        }

        .category-percent {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          color: var(--color-ink);
          min-width: 40px;
          text-align: right;
        }

        /* Quick Actions */
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--color-white-grey);
          border: 1px solid var(--color-white-border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 150ms ease;
          text-decoration: none;
          color: var(--color-ink);
        }

        .quick-action-card:hover {
          border-color: var(--color-gold);
          background: rgba(232, 168, 0, 0.05);
        }

        .quick-action-card.highlight {
          border-color: #fbbf24;
          background: rgba(251, 191, 36, 0.08);
        }

        .quick-action-card.admin-action {
          border-color: var(--color-gold);
        }

        .action-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-gold);
        }

        .action-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .action-label {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .action-desc {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        /* Two Columns */
        .dashboard-columns {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .column {
          margin-bottom: 0;
        }

        /* Activity List */
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--color-white-grey);
          border-radius: 4px;
        }

        .activity-dot {
          width: 8px;
          height: 8px;
          background: var(--color-gold);
          border-radius: 50%;
          margin-top: 6px;
        }

        .activity-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .activity-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-ink);
        }

        .activity-text strong {
          font-weight: 600;
        }

        .activity-time {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        /* System Status */
        .system-status-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--color-white-grey);
          border-radius: 4px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--color-ink-soft);
        }

        .status-indicator.success {
          background: #22c55e;
        }

        .status-indicator.info {
          background: var(--color-gold);
        }

        .status-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .status-label {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .status-value {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        /* Links Grid */
        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .link-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: var(--color-white-grey);
          border: 1px solid var(--color-white-border);
          border-radius: 6px;
          text-decoration: none;
          color: var(--color-ink);
          transition: all 150ms ease;
        }

        .link-card:hover {
          border-color: var(--color-gold);
          background: rgba(232, 168, 0, 0.05);
        }

        .link-card.primary {
          border-color: var(--color-gold);
        }

        .link-label {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
        }

        .link-url {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        .link-arrow {
          font-family: var(--font-mono);
          font-size: 16px;
          color: var(--color-gold);
        }

        /* Empty/Loading States */
        .loading-placeholder,
        .empty-state {
          padding: 40px;
          text-align: center;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-ink-soft);
          background: var(--color-white-grey);
          border-radius: 4px;
        }

        @media (max-width: 900px) {
          .stats-main {
            grid-template-columns: repeat(2, 1fr);
          }

          .stats-secondary {
            grid-template-columns: repeat(2, 1fr);
          }

          .dashboard-columns {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .stats-main {
            grid-template-columns: 1fr;
          }

          .stats-secondary {
            grid-template-columns: 1fr;
          }

          .dashboard-header {
            flex-direction: column;
            gap: 16px;
          }

          .header-time {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}

function ProductsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="16" height="5" rx="1" />
      <rect x="2" y="10" width="16" height="5" rx="1" />
    </svg>
  );
}

function SeriesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h14M3 10h14M3 14h14" />
      <circle cx="7" cy="6" r="1.5" fill="currentColor" />
      <circle cx="7" cy="10" r="1.5" fill="currentColor" />
      <circle cx="7" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function DraftsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
      <path d="M12 6H8M12 10H8M12 14H8" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="10" r="1" fill="currentColor" />
      <circle cx="6" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="16" height="6" rx="1" />
      <rect x="2" y="9" width="16" height="6" rx="1" />
      <path d="M5 5h2M5 12h2" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.657 4.343l-1.414 1.414M5.757 14.243l-1.414 1.414M15.657 15.657l-1.414-1.414M5.757 5.757L4.343 4.343" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2v16M2 10h16" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

function EnquiriesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h14a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M5 8h10M5 11h7" />
      <circle cx="15" cy="11" r="2" fill="#E8A800" stroke="none" />
    </svg>
  );
}