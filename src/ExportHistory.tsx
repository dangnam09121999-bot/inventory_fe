import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

// Custom DateInput: native picker with dd/mm/yyyy display
function DateInput({ 
  value, 
  onChange,
  id
}: { 
  value: string; 
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="date-input-wrapper">
      <input
        id={id}
        type="date"
        className="date-input-native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (typeof input.showPicker === 'function') {
            try { input.showPicker(); } catch { /* noop */ }
          }
        }}
        onFocus={(e) => {
          const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (typeof input.showPicker === 'function') {
            try { input.showPicker(); } catch { /* noop */ }
          }
        }}
      />
      <div className="date-input-display">
        {value ? formatDate(value) : <span className="date-placeholder">dd/mm/yyyy</span>}
      </div>
    </div>
  );
}

type ExportRecord = {
  id: number;
  detailId: number;
  itemName: string;
  itemId: number;
  packaging?: string;
  quantity: number;
  company?: string;
  manufacturer?: string;
  country?: string;
  lotCode?: string;
  expiredAt: string;
  exportedAt: string;
  undone: boolean;
  notes?: string;
};

type ColumnDef = {
  key: string;
  label: string;
  sortKey?: string;
  value: (r: ExportRecord) => string | number;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'ID', value: (r) => r.id },
  { key: 'itemName', label: 'Tên mặt hàng', value: (r) => r.itemName },
  { key: 'lotCode', label: 'LOT', sortKey: 'lotCode', value: (r) => r.lotCode || '' },
  { key: 'quantity', label: 'Số lượng', sortKey: 'quantity', value: (r) => r.quantity },
  { key: 'packaging', label: 'Quy cách', value: (r) => r.packaging || '' },
  { key: 'expiredAt', label: 'HSD', sortKey: 'expiredAt', value: (r) => formatDate(r.expiredAt) },
  { key: 'exportedAt', label: 'Ngày xuất', sortKey: 'exportedAt', value: (r) => formatDate(r.exportedAt) },
  { key: 'company', label: 'Công ty', value: (r) => r.company || '' },
  { key: 'manufacturer', label: 'Nhà SX', value: (r) => r.manufacturer || '' },
  { key: 'country', label: 'Nước SX', value: (r) => r.country || '' },
  { key: 'notes', label: 'Ghi chú', value: (r) => r.notes || '' },
  { key: 'status', label: 'Trạng thái', value: (r) => (r.undone ? 'Đã hoàn tác' : 'Đã xuất') },
];

const DEFAULT_VISIBLE = new Set(['id', 'itemName', 'lotCode', 'quantity', 'expiredAt', 'exportedAt', 'notes', 'status']);

type GroupedData = {
  [itemName: string]: ExportRecord[];
};

export default function ExportHistory() {
  const [data, setData] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('exportedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [groupByName, setGroupByName] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('exportHistoryColumns');
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch { /* fallthrough */ }
    }
    return new Set(DEFAULT_VISIBLE);
  });

  const toggleColumn = (key: string) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisibleColumns(next);
    localStorage.setItem('exportHistoryColumns', JSON.stringify([...next]));
  };

  const visibleColDefs = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key));

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams({
        search,
        sortBy,
        sortOrder,
      });
      
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      
      const response = await fetch(
        `${API_BASE}/inventory/export-history?${params.toString()}`,
        { headers }
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching export history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [search, sortBy, sortOrder, fromDate, toDate]);

  const onSortColumn = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  const getSortMarker = (column: string) => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'ASC' ? '↑' : '↓';
  };

  const handleUndo = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn hoàn tác xuất kho này?')) return;

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/inventory/export-history/${id}/undo`, {
        method: 'PATCH',
        headers,
      });

      if (res.ok) {
        alert('Hoàn tác thành công!');
        await fetchData();
      } else {
        const error = await res.json();
        alert(error.message || 'Không thể hoàn tác!');
      }
    } catch (error) {
      alert('Đã có lỗi xảy ra!');
    }
  };

  const canUndo = (record: ExportRecord) => {
    if (record.undone) return false;
    const now = new Date();
    const exportedAt = new Date(record.exportedAt);
    const diffDays = (now.getTime() - exportedAt.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 3;
  };

  const exportToExcel = () => {
    const cols = visibleColDefs;
    const dateRangeText = (() => {
      if (fromDate && toDate) return `từ ngày ${formatDate(fromDate)} đến ngày ${formatDate(toDate)}`;
      if (fromDate) return `từ ngày ${formatDate(fromDate)}`;
      if (toDate) return `đến ngày ${formatDate(toDate)}`;
      return 'toàn bộ';
    })();
    const title = `Thông tin lịch sử xuất kho ${dateRangeText}`;
    const aoa: (string | number)[][] = [
      [title],
      [],
      cols.map((c) => c.label),
      ...data.map((r) => cols.map((c) => c.value(r))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (cols.length > 1) {
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử xuất kho');
    XLSX.writeFile(wb, `lich-su-xuat-kho-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const groupedData: GroupedData = data.reduce((acc, record) => {
    const name = record.itemName || 'Không tên';
    if (!acc[name]) {
      acc[name] = [];
    }
    acc[name].push(record);
    return acc;
  }, {} as GroupedData);

  if (loading) return <div className="inventory-app"><p>Đang tải...</p></div>;

  return (
    <main className="inventory-app">
      <header className="header">
        <div>
          <p className="eyebrow">Export History</p>
          <h1>Lịch sử xuất kho</h1>
          <p className="subtitle">Danh sách các lần xuất kho đã thực hiện.</p>
        </div>
      </header>

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <label htmlFor="export-search">Tìm kiếm theo tên sản phẩm</label>
            <input
              id="export-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập tên sản phẩm..."
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="field-group" style={{ minWidth: 160 }}>
              <label htmlFor="from-date">Từ ngày</label>
              <DateInput
                id="from-date"
                value={fromDate}
                onChange={setFromDate}
              />
            </div>
            <div className="field-group" style={{ minWidth: 160 }}>
              <label htmlFor="to-date">Đến ngày</label>
              <DateInput
                id="to-date"
                value={toDate}
                onChange={setToDate}
              />
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className={showColumnSelector ? 'secondary-btn' : 'ghost-btn'}
              onClick={() => setShowColumnSelector(!showColumnSelector)}
            >
              ⚙️ Chọn cột
            </button>
            <button
              type="button"
              className={groupByName ? 'secondary-btn' : 'ghost-btn'}
              onClick={() => setGroupByName(!groupByName)}
            >
              {groupByName ? '📦 Grouped' : '📋 List'}
            </button>
            <button type="button" className="secondary-btn" onClick={exportToExcel}>
              📥 Export Excel
            </button>
          </div>
        </div>
        {showColumnSelector && (
          <div style={{ marginTop: 12, padding: 16, background: '#f7f7fa', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {groupByName ? (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên mặt hàng</th>
                <th>Tổng xuất</th>
                <th>Đã hoàn tác</th>
                <th>Số lần xuất</th>
                <th>Ngày xuất đầu tiên</th>
                <th>Ngày xuất gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedData).length === 0 ? (
                <tr>
                  <td colSpan={6} className="center muted">
                    Chưa có lịch sử xuất kho
                  </td>
                </tr>
              ) : (
                Object.entries(groupedData).map(([itemName, records]) => {
                  const totalExported = records.filter(r => !r.undone).reduce((sum, r) => sum + r.quantity, 0);
                  const undoneQuantity = records.filter(r => r.undone).reduce((sum, r) => sum + r.quantity, 0);
                  const exportCount = records.length;
                  const sortedByDate = [...records].sort((a, b) => 
                    new Date(a.exportedAt).getTime() - new Date(b.exportedAt).getTime()
                  );
                  const firstExportDate = sortedByDate[0]?.exportedAt;
                  const lastExportDate = sortedByDate[sortedByDate.length - 1]?.exportedAt;
                  const itemId = records[0]?.itemId;

                  return (
                    <tr key={itemName}>
                      <td>
                        {itemId ? (
                          <Link to={`/inventory/${itemId}/details`}>
                            <strong>{itemName}</strong>
                          </Link>
                        ) : (
                          <strong>{itemName}</strong>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#e74c3c', fontSize: 18 }}>{totalExported}</strong>
                      </td>
                      <td>
                        {undoneQuantity > 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{undoneQuantity}</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>{exportCount}</td>
                      <td>{formatDate(firstExportDate)}</td>
                      <td>{formatDate(lastExportDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                {visibleColDefs.map((col) => (
                  <th key={col.key}>
                    {col.sortKey ? (
                      <button type="button" className="sort-header-btn" onClick={() => onSortColumn(col.sortKey!)}>
                        {col.label} <span className="sort-indicator">{getSortMarker(col.sortKey)}</span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                <th>Tác vụ</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColDefs.length + 1} className="center muted">
                    Chưa có lịch sử xuất kho
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} style={{ backgroundColor: row.undone ? '#f0fdf4' : 'transparent' }}>
                    {visibleColDefs.map((col) => {
                      if (col.key === 'itemName') {
                        return (
                          <td key={col.key}>
                            {row.itemId ? (
                              <Link to={`/inventory/${row.itemId}/details`}>{row.itemName}</Link>
                            ) : (
                              row.itemName
                            )}
                          </td>
                        );
                      }
                      if (col.key === 'quantity') {
                        return (
                          <td key={col.key}>
                            <strong style={{ color: row.undone ? '#16a34a' : '#2c3e50' }}>{row.quantity}</strong>
                          </td>
                        );
                      }
                      if (col.key === 'notes') {
                        return (
                          <td key={col.key} style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.notes || '-'}
                          </td>
                        );
                      }
                      if (col.key === 'status') {
                        return (
                          <td key={col.key}>
                            <span style={{ color: row.undone ? '#16a34a' : '#3b82f6' }}>
                              {row.undone ? 'Đã hoàn tác' : 'Đã xuất'}
                            </span>
                          </td>
                        );
                      }
                      const v = col.value(row);
                      return <td key={col.key}>{v === '' ? '-' : v}</td>;
                    })}
                    <td className="action-cell">
                      {canUndo(row) && (
                        <button type="button" className="secondary-btn" onClick={() => void handleUndo(row.id)}>
                          Hoàn tác
                        </button>
                      )}
                      {!canUndo(row) && !row.undone && (
                        <span className="muted" style={{ fontSize: '12px' }}>
                          Quá hạn
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
