import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
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

type ImportRecord = {
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
  manufacturedAt?: string;
  expiredAt: string;
  receivedAt: string;
  notes?: string;
  createdAt: string;
};

type ColumnDef = {
  key: string;
  label: string;
  sortKey?: string;
  value: (r: ImportRecord) => string | number;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'ID', value: (r) => r.id },
  { key: 'itemName', label: 'Tên mặt hàng', value: (r) => r.itemName },
  { key: 'lotCode', label: 'LOT', sortKey: 'lotCode', value: (r) => r.lotCode || '' },
  { key: 'quantity', label: 'Số lượng', sortKey: 'quantity', value: (r) => r.quantity },
  { key: 'packaging', label: 'Quy cách', value: (r) => r.packaging || '' },
  { key: 'manufacturedAt', label: 'NSX', value: (r) => formatDate(r.manufacturedAt) },
  { key: 'expiredAt', label: 'HSD', sortKey: 'expiredAt', value: (r) => formatDate(r.expiredAt) },
  { key: 'receivedAt', label: 'Ngày nhập', sortKey: 'receivedAt', value: (r) => formatDate(r.receivedAt) },
  { key: 'company', label: 'Công ty', value: (r) => r.company || '' },
  { key: 'manufacturer', label: 'Nhà SX', value: (r) => r.manufacturer || '' },
  { key: 'country', label: 'Nước SX', value: (r) => r.country || '' },
  { key: 'notes', label: 'Ghi chú', value: (r) => r.notes || '' },
];

const DEFAULT_VISIBLE = new Set(['id', 'itemName', 'lotCode', 'quantity', 'expiredAt', 'receivedAt', 'company', 'manufacturer', 'notes']);

type GroupedData = {
  [itemName: string]: ImportRecord[];
};

export default function ImportHistory() {
  const [data, setData] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('receivedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ImportRecord | null>(null);
  const [groupByName, setGroupByName] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('importHistoryColumns');
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
    localStorage.setItem('importHistoryColumns', JSON.stringify([...next]));
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
        `${API_BASE}/inventory/import-history?${params.toString()}`,
        { headers }
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching import history:', error);
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Đã copy');
    } catch {
      alert('Copy thất bại');
    }
  };

  const copyAllInfo = (record: ImportRecord) => {
    const text = `${record.itemName}
LOT: ${record.lotCode || ''}
HSD: ${formatDate(record.expiredAt)}
Số lượng: ${record.quantity}`;
    void handleCopy(text);
  };

  const exportToExcel = () => {
    const cols = visibleColDefs;
    const dateRangeText = (() => {
      if (fromDate && toDate) return `từ ngày ${formatDate(fromDate)} đến ngày ${formatDate(toDate)}`;
      if (fromDate) return `từ ngày ${formatDate(fromDate)}`;
      if (toDate) return `đến ngày ${formatDate(toDate)}`;
      return 'toàn bộ';
    })();
    const title = `Thông tin lịch sử nhập kho ${dateRangeText}`;
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
    XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử nhập kho');
    XLSX.writeFile(wb, `lich-su-nhap-kho-${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <p className="eyebrow">Import History</p>
          <h1>Lịch sử nhập kho</h1>
          <p className="subtitle">Danh sách các lần nhập kho đã thực hiện.</p>
        </div>
      </header>

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <label htmlFor="import-search">Tìm kiếm theo tên sản phẩm</label>
            <input
              id="import-search"
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
                <th>Tổng số lượng</th>
                <th>Số lần nhập</th>
                <th>Ngày nhập đầu tiên</th>
                <th>Ngày nhập gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedData).length === 0 ? (
                <tr>
                  <td colSpan={5} className="center muted">
                    Chưa có lịch sử nhập kho
                  </td>
                </tr>
              ) : (
                Object.entries(groupedData).map(([itemName, records]) => {
                  const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
                  const importCount = records.length;
                  const sortedByDate = [...records].sort((a, b) => 
                    new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
                  );
                  const firstImportDate = sortedByDate[0]?.receivedAt;
                  const lastImportDate = sortedByDate[sortedByDate.length - 1]?.receivedAt;
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
                        <strong style={{ color: '#16a34a', fontSize: 18 }}>{totalQuantity}</strong>
                      </td>
                      <td>{importCount}</td>
                      <td>{formatDate(firstImportDate)}</td>
                      <td>{formatDate(lastImportDate)}</td>
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
                    Chưa có lịch sử nhập kho
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
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
                        return <td key={col.key}><strong>{row.quantity}</strong></td>;
                      }
                      const v = col.value(row);
                      return <td key={col.key}>{v === '' ? '-' : v}</td>;
                    })}
                    <td className="action-cell">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecord(row);
                          setShowInfoModal(true);
                        }}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {showInfoModal && selectedRecord && (
        <div className="modal-backdrop" onClick={() => setShowInfoModal(false)}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-header">
              <h2>Thông tin nhập kho</h2>
            </div>

            <div className="success-card">
              <div className="success-item-name">{selectedRecord.itemName}</div>

              <div className="success-row">
                <span>LOT: </span>
                <strong>{selectedRecord.lotCode || 'N/A'}</strong>
              </div>

              <div className="success-row">
                <span>HSD: </span>
                <strong>{formatDate(selectedRecord.expiredAt)}</strong>
              </div>

              <div className="success-row">
                <span>Số lượng: </span>
                <strong>{selectedRecord.quantity}</strong>
              </div>

              <div className="success-row">
                <span>Ngày nhập: </span>
                <strong>{formatDate(selectedRecord.receivedAt)}</strong>
              </div>

              {selectedRecord.company && (
                <div className="success-row">
                  <span>Công ty: </span>
                  <strong>{selectedRecord.company}</strong>
                </div>
              )}

              {selectedRecord.manufacturer && (
                <div className="success-row">
                  <span>Nhà sản xuất: </span>
                  <strong>{selectedRecord.manufacturer}</strong>
                </div>
              )}

              {selectedRecord.notes && (
                <div className="success-row">
                  <span>Ghi chú: </span>
                  <strong>{selectedRecord.notes}</strong>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => copyAllInfo(selectedRecord)}>
                📋 Copy thông tin
              </button>

              <button type="button" className="ghost-btn" onClick={() => setShowInfoModal(false)}>
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
