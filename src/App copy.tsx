import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from 'react-router-dom'
import Login from './Login'
import ImportHistory from './ImportHistory'
import ExportHistory from './ExportHistory'

type InventoryItem = {
  id: number;
  name: string;
  hospitalId: string;
  cas: string;
  unit: string;
  quantity: number;
}

type InventoryDetail = {
  id: number;
  packaging: string;
  quantity: number;
  company: string;
  manufacturer: string;
  country: string;
  lotCode: string;
  manufacturedAt: string | null;
  expiredAt: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}
type DetailSortBy = keyof InventoryDetail;

type Overview = {
  totalItems: number
  totalQuantity: number
  expiredLots: number
  expiringSoonLots: number
}

type SortBy = keyof InventoryItem

const Action = "Tác vụ"

type InventoryFieldLabelRecord = Record<keyof InventoryItem, string>

const InventoryFieldLabel: InventoryFieldLabelRecord = {
  id: 'ID',
  name: 'Tên mặt hàng',
  hospitalId: 'Mã BV',
  cas: 'CAS',
  unit: 'Đơn vị tính',
  quantity: 'Số lượng',
}

const InventoryDetailsFieldLabel: Record<keyof InventoryDetail, string> = {
  id: 'ID',
  packaging: 'Quy cách',
  quantity: 'Số lượng',
  company: 'Công ty cung cấp',
  manufacturer: 'Hãng sản xuất',
  country: 'Nước sản xuất',
  lotCode: 'LOT',
  manufacturedAt: 'Ngày sản xuất',
  expiredAt: 'Hạn sử dụng',
  receivedAt: 'Ngày nhập',
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày cập nhật',
}

const API_BASE = 'http://localhost:3000'

const emptyItemForm = {
  name: '',
  hospitalId: '',
  cas: '',
  unit: '',
  quantity: '',
}

const getStoredToken = () => localStorage.getItem('token')

const getAuthHeaders = () => {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : null
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`
}

function InventoryPage({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddDetailModal, setShowAddDetailModal] = useState(false)
  const [activeDetailItemId, setActiveDetailItemId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addingDetail, setAddingDetail] = useState(false)
  const [form, setForm] = useState(emptyItemForm)
  const [detailForm, setDetailForm] = useState({
    packaging: '',
    quantity: '',
    company: '',
    manufacturer: '',
    country: '',
    lotCode: '',
    manufacturedAt: '',
    expiredAt: '',
    receivedAt: '',
    noExpiry: false,
    receivedToday: true,
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyItemForm)
  const [savingEdit, setSavingEdit] = useState(false)
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  // Modal nhập kho thành công
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const [successInfo, setSuccessInfo] = useState<{
    name: string
    hospitalId: string
    lot: string
    expiredAt: string
  } | null>(null)

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Đã copy')
    } catch {
      alert('Copy thất bại')
    }
  }

  const copyAllInfo = () => {
    if (!successInfo) return

    const text = `${successInfo.name}
${InventoryFieldLabel.hospitalId}: ${successInfo.hospitalId}
${InventoryDetailsFieldLabel.lotCode}: ${successInfo.lot}
${InventoryDetailsFieldLabel.expiredAt}: ${formatDate(successInfo.expiredAt)}`
    void handleCopy(text)
  }
  const refreshData = async () => {
    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      setLoading(false)
      return
    }

    try {
      const [itemsRes, overviewRes] = await Promise.all([
        fetch(`${API_BASE}/inventory?search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`, { headers }),
        fetch(`${API_BASE}/inventory/overview`, { headers }),
      ])

      if (!itemsRes.ok || !overviewRes.ok) {
        throw new Error('Khong the tai du lieu')
      }

      const itemsData = await itemsRes.json()
      const overviewData = await overviewRes.json()

      setItems(itemsData)
      setOverview(overviewData)
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshData()
  }, [search, sortBy, sortOrder])

  const onSortColumn = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(column)
    setSortOrder('asc')
  }

  const getSortMarker = (column: SortBy) => {
    if (sortBy !== column) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const resetForm = () => {
    setForm(emptyItemForm)
  }

  const resetDetailForm = () => {
    const today = new Date().toISOString().slice(0, 10)
    setDetailForm({
      packaging: '',
      quantity: '',
      company: '',
      manufacturer: '',
      country: '',
      lotCode: '',
      manufacturedAt: '',
      expiredAt: '',
      receivedAt: today,
      noExpiry: false,
      receivedToday: true,
    })
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openAddDetailModal = (itemId: number) => {
    setActiveDetailItemId(itemId)
    resetDetailForm()
    setShowAddDetailModal(true)
  }

  const activeDetailItem = activeDetailItemId
    ? items.find((item) => item.id === activeDetailItemId)
    : null

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault()
    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          hospitalId: form.hospitalId,
          cas: form.cas,
          unit: form.unit,
        }),
      })

      if (!response.ok) {
        throw new Error('Them hang that bai. Kiem tra du lieu nhap vao.')
      }

      resetForm()
      setShowCreateModal(false)
      await refreshData()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const onStartEdit = (item: InventoryItem) => {
    setEditingId(item.id)
    setEditForm({
      ...emptyItemForm,
      name: item.name,
      hospitalId: item.hospitalId,
      cas: item.cas,
      unit: item.unit,
    })
  }

  const onSaveEdit = async (id: number) => {
    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setSavingEdit(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/inventory/${id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          hospitalId: editForm.hospitalId,
          cas: editForm.cas,
          unit: editForm.unit,
        }),
      })

      if (!response.ok) {
        throw new Error('Cap nhat mat hang that bai')
      }

      setEditingId(null)
      setEditForm(emptyItemForm)
      await refreshData()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setSavingEdit(false)
    }
  }

  const onAddDetail = async (event: FormEvent) => {
    event.preventDefault()
    if (activeDetailItemId === null) {
      setError('Không có mặt hàng được chọn để nhập kho')
      return
    }

    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setAddingDetail(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/inventory/${activeDetailItemId}/details`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packaging: detailForm.packaging,
          quantity: Number(detailForm.quantity),
          company: detailForm.company,
          manufacturer: detailForm.manufacturer,
          country: detailForm.country,
          lotCode: detailForm.lotCode,
          manufacturedAt: detailForm.manufacturedAt || null,
          expiredAt: detailForm.expiredAt,
          receivedAt: detailForm.receivedAt,
        }),
      })

      if (!response.ok) {
        throw new Error('Nhập kho chi tiết thất bại')
      }
      setSuccessInfo({
        name: activeDetailItem?.name || '',
        hospitalId: activeDetailItem?.hospitalId || '',
        lot: detailForm.lotCode,
        expiredAt: detailForm.expiredAt,
      })

      setShowSuccessModal(true)

      setShowAddDetailModal(false)
      setActiveDetailItemId(null)

      resetDetailForm()
      await refreshData()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setAddingDetail(false)
    }
  }
  {
    showSuccessModal && successInfo && (
      <div className="modal-backdrop" role="presentation" onClick={() => setShowSuccessModal(false)}>
        <section className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Nhập kho thành công!</h2>
            <button type="button" className="close-btn" onClick={() => setShowSuccessModal(false)}>
              ×
            </button>
          </div>
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ minWidth: 100 }}>Tên mặt hàng:</b>
              <span>{successInfo.name}</span>
              <button style={{ marginLeft: 8 }} onClick={() => handleCopy(successInfo.name)} title="Copy">📋</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ minWidth: 100 }}>Mã BV:</b>
              <span>{successInfo.hospitalId}</span>
              <button style={{ marginLeft: 8 }} onClick={() => handleCopy(successInfo.hospitalId)} title="Copy">📋</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ minWidth: 100 }}>Lot:</b>
              <span>{successInfo.lot}</span>
              <button style={{ marginLeft: 8 }} onClick={() => handleCopy(successInfo.lot)} title="Copy">📋</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ minWidth: 100 }}>HSD:</b>
              <span>{successInfo.expiredAt}</span>
              <button style={{ marginLeft: 8 }} onClick={() => handleCopy(successInfo.expiredAt)} title="Copy">📋</button>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="button" className="ghost-btn" onClick={() => setShowSuccessModal(false)}>
              Đóng
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <>
      <main className="inventory-app">
        <header className="header">
          <div>
            <p className="eyebrow">Warehouse Dashboard</p>
            <h1>Quản lý tồn kho</h1>
            <p className="subtitle">Hiển thị tồn kho hiện tại, cập nhật nhanh và theo dõi hạn sử dụng.</p>
          </div>
          <div className="header-right">
            <button type="button" className="ghost-btn logout-top" onClick={onLogout}>
              Đăng Xuất
            </button>
          </div>
        </header>

        {overview && (
          <section className="overview-grid">
            <article className="card">
              <h2>Tổng Mặt Hàng</h2>
              <strong>{overview.totalItems}</strong>
            </article>
            {/* <article className="card">
              <h2>Tổng Số Lượng</h2>
              <strong>{overview.totalQuantity}</strong>
            </article> */}
            <article className="card">
              <h2>Mặt Hàng Sắp Hết Hạn &le; 30 ngày</h2>
              <strong>{overview.expiringSoonLots}</strong>
            </article>
            <article className="card">
              <h2>Mặt Hàng Đã Hết Hạn</h2>
              <strong>{overview.expiredLots}</strong>
            </article>
          </section>
        )}

        <section className="panel">
          <div className="toolbar">
            <div className="search-box">
              <label htmlFor="inventory-search">Tìm kiếm theo tên mặt hàng</label>
              <input
                id="inventory-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="VD: Khẩu trang"
              />
            </div>
            <div className="toolbar-actions">
              <button type="button" onClick={openCreateModal}>
                Thêm mặt hàng mới
              </button>
            </div>
          </div>
        </section>

        {loading && <p>Dang tai du lieu...</p>}
        {!loading && error && <p>{error}</p>}
        {!loading && !error && (
          <section className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('id')}>
                      {InventoryFieldLabel.id} <span className="sort-indicator">{getSortMarker('id')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('name')}>
                      {InventoryFieldLabel.name} <span className="sort-indicator">{getSortMarker('name')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('hospitalId')}>
                      {InventoryFieldLabel.hospitalId} <span className="sort-indicator">{getSortMarker('hospitalId')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('cas')}>
                      {InventoryFieldLabel.cas} <span className="sort-indicator">{getSortMarker('cas')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('unit')}>
                      {InventoryFieldLabel.unit} <span className="sort-indicator">{getSortMarker('unit')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-header-btn" onClick={() => onSortColumn('quantity')}>
                      {InventoryFieldLabel.quantity} <span className="sort-indicator">{getSortMarker('quantity')}</span>
                    </button>
                  </th>
                  <th>{Action}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="center muted">
                      Khong co mat hang nao
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isEditing = editingId === item.id
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.hospitalId}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, hospitalId: event.target.value }))
                              }
                            />
                          ) : (
                            item.hospitalId
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.cas}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, cas: event.target.value }))
                              }
                            />
                          ) : (
                            item.cas
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.unit}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, unit: event.target.value }))
                              }
                            />
                          ) : (
                            item.unit
                          )}
                        </td>
                        <td>{item.quantity}</td>
                        <td className="action-cell">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void onSaveEdit(item.id)}
                                disabled={savingEdit}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => setEditingId(null)}
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => onStartEdit(item)}>
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/inventory/${item.id}/details`)}
                              >
                                Chi tiết
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => openAddDetailModal(item.id)}
                              >
                                Nhập kho
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </section>
        )}

        {showCreateModal && (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowCreateModal(false)}>
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Thêm mặt hàng mới</p>
                  <h2>Thêm mặt hàng mới</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowCreateModal(false)}>
                  ×
                </button>
              </div>
              <form onSubmit={onAddItem} className="item-form grid-form">
                <div className="field-group">
                  <label>{InventoryFieldLabel.name} *</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="field-group">
                  <label>{InventoryFieldLabel.hospitalId}</label>
                  <input
                    value={form.hospitalId}
                    onChange={(event) => setForm((prev) => ({ ...prev, hospitalId: event.target.value }))}
                    required
                  />
                </div>
                <div className="field-group">
                  <label>{InventoryFieldLabel.cas}</label>
                  <input
                    value={form.cas}
                    onChange={(event) => setForm((prev) => ({ ...prev, cas: event.target.value }))}
                    required
                  />
                </div>
                <div className="field-group">
                  <label>{InventoryFieldLabel.unit} *</label>
                  <input
                    value={form.unit}
                    onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Dang them...' : 'Thêm mặt hàng'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {showAddDetailModal && (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowAddDetailModal(false)}>
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Nhập kho chi tiết</p>
                  <h2>Nhập kho cho mặt hàng</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowAddDetailModal(false)}>
                  ×
                </button>
              </div>
              {activeDetailItem && (
                <section className="detail-summary-card">
                  <div>
                    <strong>Tên mặt hàng:</strong> {activeDetailItem.name}
                  </div>
                  <div>
                    <strong>Mã BV:</strong> {activeDetailItem.hospitalId}
                  </div>
                  <div>
                    <strong>CAS:</strong> {activeDetailItem.cas}
                  </div>
                  <div>
                    <strong>Đơn vị:</strong> {activeDetailItem.unit}
                  </div>
                  <div>
                    <strong>Số lượng hiện tại:</strong> {activeDetailItem.quantity}
                  </div>
                </section>
              )}
              <form onSubmit={onAddDetail} className="item-form grid-form">
                <div className="field-group">
                  <label>Quy cách</label>
                  <input
                    value={detailForm.packaging}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, packaging: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Số lượng *</label>
                  <input
                    type="number"
                    min={0}
                    value={detailForm.quantity}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, quantity: event.target.value }))}
                    required
                  />
                </div>
                <div className="field-group">
                  <label>Công ty</label>
                  <input
                    value={detailForm.company}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, company: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Nhà sản xuất</label>
                  <input
                    value={detailForm.manufacturer}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, manufacturer: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Quốc gia</label>
                  <input
                    value={detailForm.country}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, country: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>LOT</label>
                  <input
                    value={detailForm.lotCode}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, lotCode: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Ngày sản xuất</label>
                  <input
                    type="date"
                    value={detailForm.manufacturedAt}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, manufacturedAt: event.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Hạn sử dụng *</label>
                  <input
                    type="date"
                    value={detailForm.expiredAt}
                    onChange={(event) => setDetailForm((prev) => ({
                      ...prev,
                      expiredAt: event.target.value,
                      noExpiry: false,
                    }))}
                    required
                    disabled={detailForm.noExpiry}
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={detailForm.noExpiry}
                      onChange={(event) => {
                        const checked = event.target.checked
                        setDetailForm((prev) => ({
                          ...prev,
                          noExpiry: checked,
                          expiredAt: checked ? '2099-01-01' : '',
                        }))
                      }}
                    />
                    Không HSD
                  </label>
                </div>
                <div className="field-group">
                  <label>Ngày nhập *</label>
                  <input
                    type="date"
                    value={detailForm.receivedAt}
                    onChange={(event) => setDetailForm((prev) => ({
                      ...prev,
                      receivedAt: event.target.value,
                      receivedToday: false,
                    }))}
                    required
                    disabled={detailForm.receivedToday}
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={detailForm.receivedToday}
                      onChange={(event) => {
                        const checked = event.target.checked
                        const today = new Date().toISOString().slice(0, 10)
                        setDetailForm((prev) => ({
                          ...prev,
                          receivedToday: checked,
                          receivedAt: checked ? today : '',
                        }))
                      }}
                    />
                    Ngày nhập là hôm nay
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setShowAddDetailModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" disabled={addingDetail}>
                    {addingDetail ? 'Đang thêm...' : 'Nhập kho'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {showSuccessModal && successInfo && (
          <div
            className="modal-backdrop"
            onClick={() => setShowSuccessModal(false)}
          >
            <section
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="success-header">
                <div>
                  <h2>Nhập kho thành công</h2>
                </div>
              </div>

              <div className="success-card">
                <div className="success-item-name">
                  {successInfo.name}
                </div>

                <div className="success-row">
                  <span>Mã BV: </span>
                  <strong>{successInfo.hospitalId}</strong>
                </div>

                <div className="success-row">
                  <span>LOT: </span>
                  <strong>{successInfo.lot}</strong>
                </div>

                <div className="success-row">
                  <span>HSD: </span>
                  <strong>{formatDate(successInfo.expiredAt)}</strong>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={copyAllInfo}
                >
                  📋 Copy thông tin
                </button>

                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Đóng
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  )
}

function InventoryDetailPage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<(InventoryItem & { details: InventoryDetail[] }) | null>(null)
  const [details, setDetails] = useState<InventoryDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null)
  const [editDetailForm, setEditDetailForm] = useState({
    packaging: '',
    quantity: '',
    company: '',
    manufacturer: '',
    country: '',
    lotCode: '',
    manufacturedAt: '',
    expiredAt: '',
    receivedAt: '',
  })
  const [savingDetail, setSavingDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [sortBy, setSortBy] = useState<DetailSortBy>('expiredAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null)
  const [exportQuantity, setExportQuantity] = useState('1')
  const refreshDetails = async () => {
    if (!id) return

    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/inventory/${id}/details`, { headers })
      if (!response.ok) {
        throw new Error('Khong the tai thong tin chi tiet')
      }
      const data = await response.json()
      setItem(data)
      setDetails(data.details ?? [])
      setError('')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshDetails()
  }, [id])

  const onStartDetailEdit = (detail: InventoryDetail) => {
    setEditingDetailId(detail.id)
    setEditDetailForm({
      packaging: detail.packaging,
      quantity: String(detail.quantity),
      company: detail.company,
      manufacturer: detail.manufacturer,
      country: detail.country,
      lotCode: detail.lotCode,
      manufacturedAt: detail.manufacturedAt ?? '',
      expiredAt: detail.expiredAt,
      receivedAt: detail.receivedAt,
    })
  }

  const onSaveDetail = async (detailId: number) => {
    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setSavingDetail(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/inventory/details/${detailId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packaging: editDetailForm.packaging,
          quantity: Number(editDetailForm.quantity),
          company: editDetailForm.company,
          manufacturer: editDetailForm.manufacturer,
          country: editDetailForm.country,
          lotCode: editDetailForm.lotCode,
          manufacturedAt: editDetailForm.manufacturedAt || null,
          expiredAt: editDetailForm.expiredAt,
          receivedAt: editDetailForm.receivedAt,
        }),
      })
      if (!response.ok) {
        throw new Error('Cap nhat chi tiet that bai')
      }
      setEditingDetailId(null)
      await refreshDetails()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setSavingDetail(false)
    }
  }

  const onExportDetail = async (
    detailId: number,
    quantity: number,
  ) => {
    const headers = getAuthHeaders()

    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setActionLoading(true)

    try {
      const response = await fetch(
        `${API_BASE}/inventory/details/${detailId}/export`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Xuat kho that bai')
      }

      await refreshDetails()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const onDeleteDetail = async (detailId: number) => {
    const headers = getAuthHeaders()
    if (!headers) {
      setError('Ban chua dang nhap')
      return
    }

    setActionLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/inventory/details/${detailId}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        throw new Error('Xoa chi tiet that bai')
      }
      await refreshDetails()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Da co loi xay ra'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }
  const onSortColumn = (column: DetailSortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortBy(column)
    setSortOrder('asc')
  }

  const getSortMarker = (column: DetailSortBy) => {
    if (sortBy !== column) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }
  const sortedDetails = [...details].sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]

    if (
      sortBy === 'manufacturedAt' ||
      sortBy === 'expiredAt' ||
      sortBy === 'receivedAt'
    ) {
      const aDate = aValue ? new Date(aValue).getTime() : 0
      const bDate = bValue ? new Date(bValue).getTime() : 0

      return sortOrder === 'asc'
        ? aDate - bDate
        : bDate - aDate
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc'
        ? aValue - bValue
        : bValue - aValue
    }

    return sortOrder === 'asc'
      ? String(aValue ?? '').localeCompare(String(bValue ?? ''))
      : String(bValue ?? '').localeCompare(String(aValue ?? ''))
  })

  return (
    <>
      <main className="inventory-app">
        <header className="header">
          <div>
            <p className="eyebrow">Chi tiết tồn kho</p>
            <h1>Chi tiết mặt hàng</h1>
            <p className="subtitle">Thông tin chi tiết và lô hàng của mặt hàng này.</p>
          </div>
          <div className="header-right">
            <button type="button" className="ghost-btn logout-top" onClick={onLogout}>
              Đăng Xuất
            </button>
          </div>
        </header>

        <div className="toolbar">
          <button type="button" className="ghost-btn" onClick={() => navigate('/inventory')}>
            Quay lại danh sách
          </button>
        </div>

        {loading && <p>Đang tải chi tiết...</p>}
        {!loading && error && <p>{error}</p>}

        {!loading && !error && item && (
          <section className="panel">
            <div className="item-summary">
              <div>
                <strong>Tên:</strong> {item.name}
              </div>
              <div>
                <strong>Mã BV:</strong> {item.hospitalId}
              </div>
              <div>
                <strong>CAS:</strong> {item.cas}
              </div>
              <div>
                <strong>Đơn vị:</strong> {item.unit}
              </div>
              <div>
                <strong>Tổng số lượng:</strong> {item.quantity}
              </div>
            </div>

            <section className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{InventoryDetailsFieldLabel.packaging}</th>
                    <th>{InventoryDetailsFieldLabel.company}</th>
                    <th>{InventoryDetailsFieldLabel.manufacturer}</th>
                    <th>{InventoryDetailsFieldLabel.country}</th>
                    <th>
                      <button
                        type="button"
                        className="sort-header-btn"
                        onClick={() => onSortColumn('lotCode')}
                      >
                        {InventoryDetailsFieldLabel.lotCode}
                        <span className="sort-indicator">
                          {getSortMarker('lotCode')}
                        </span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-header-btn"
                        onClick={() => onSortColumn('quantity')}
                      >
                        {InventoryDetailsFieldLabel.quantity}
                        <span className="sort-indicator">
                          {getSortMarker('quantity')}
                        </span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-header-btn"
                        onClick={() => onSortColumn('manufacturedAt')}
                      >
                        {InventoryDetailsFieldLabel.manufacturedAt}
                        <span className="sort-indicator">
                          {getSortMarker('manufacturedAt')}
                        </span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-header-btn"
                        onClick={() => onSortColumn('expiredAt')}
                      >
                        {InventoryDetailsFieldLabel.expiredAt}
                        <span className="sort-indicator">
                          {getSortMarker('expiredAt')}
                        </span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-header-btn"
                        onClick={() => onSortColumn('receivedAt')}
                      >
                        {InventoryDetailsFieldLabel.receivedAt}
                        <span className="sort-indicator">
                          {getSortMarker('receivedAt')}
                        </span>
                      </button>
                    </th>
                    <th>{Action}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDetails.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="center muted">
                        Chưa có chi tiết nào
                      </td>
                    </tr>
                  ) : (
                    sortedDetails.map((detail) => {
                      const isEditing = editingDetailId === detail.id
                      return (
                        <tr key={detail.id}>
                          <td>{detail.id}</td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.packaging}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, packaging: event.target.value }))
                                }
                              />
                            ) : (
                              detail.packaging
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.company}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, company: event.target.value }))
                                }
                              />
                            ) : (
                              detail.company
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.manufacturer}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, manufacturer: event.target.value }))
                                }
                              />
                            ) : (
                              detail.manufacturer
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.country}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, country: event.target.value }))
                                }
                              />
                            ) : (
                              detail.country
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.lotCode}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, lotCode: event.target.value }))
                                }
                              />
                            ) : (
                              detail.lotCode
                            )}
                          </td>
                          <td>{detail.quantity}</td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.manufacturedAt}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, manufacturedAt: event.target.value }))
                                }
                              />
                            ) : (
                              detail.manufacturedAt
                            )}
                          </td>                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.expiredAt}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, expiredAt: event.target.value }))
                                }
                              />
                            ) : (
                              detail.expiredAt
                            )}
                          </td>                          <td>
                            {isEditing ? (
                              <input
                                value={editDetailForm.receivedAt}
                                onChange={(event) =>
                                  setEditDetailForm((prev) => ({ ...prev, receivedAt: event.target.value }))
                                }
                              />
                            ) : (
                              detail.receivedAt
                            )}
                          </td>
                          <td className="action-cell">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void onSaveDetail(detail.id)}
                                  disabled={savingDetail}
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  onClick={() => setEditingDetailId(null)}
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => onStartDetailEdit(detail)}>
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDetailId(detail.id)
                                    setExportQuantity('1')
                                    setShowExportModal(true)
                                  }}
                                >
                                  Xuất Kho
                                </button>
                                <button
                                  type="button"
                                  className="danger-btn"
                                  onClick={() => void onDeleteDetail(detail.id)}
                                  disabled={detail.quantity > 0 || actionLoading}
                                >
                                  Xóa
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </section>
          </section>
        )}
      </main>
      {showExportModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowExportModal(false)}
        >
          <section
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Xuất kho</h2>

            <div className="field-group">
              <label>Số lượng xuất</label>

              <input
                type="number"
                min={1}
                value={exportQuantity}
                onChange={(e) => setExportQuantity(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button
                className="ghost-btn"
                onClick={() => setShowExportModal(false)}
              >
                Hủy
              </button>

              <button
                onClick={async () => {
                  if (!selectedDetailId) return

                  await onExportDetail(
                    selectedDetailId,
                    Number(exportQuantity),
                  )

                  setShowExportModal(false)
                }}
              >
                Xác nhận xuất
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function Sidebar() {
  const location = useLocation();
  const links = [
    { to: '/inventory', label: 'Tồn kho' },
    { to: '/import-history', label: 'Lịch sử nhập kho' },
    { to: '/export-history', label: 'Lịch sử xuất kho' },
  ];
  return (
    <nav className="sidebar">
      <ul>
        {links.map((link) => (
          <li key={link.to} className={location.pathname.startsWith(link.to) ? 'active' : ''}>
            <Link to={link.to}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(getStoredToken)

  useEffect(() => {
    const syncAuthState = () => {
      setToken(getStoredToken())
    }
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('focus', syncAuthState)
    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('focus', syncAuthState)
    }
  }, [])

  const onLoginSuccess = (nextToken: string) => {
    localStorage.setItem('token', nextToken)
    setToken(nextToken)
  }

  const onLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  const isAuthenticated = Boolean(token)

  return (
    <Router>
      <div className="layout">
        {isAuthenticated && <Sidebar />}
        <div className="main-content">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={isAuthenticated ? '/inventory' : '/login'} replace />}
            />
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to="/inventory" replace />
                ) : (
                  <Login onLoginSuccess={onLoginSuccess} />
                )
              }
            />
            <Route
              path="/inventory"
              element={
                isAuthenticated ? <InventoryPage onLogout={onLogout} /> : <Navigate to="/login" replace />
              }
            />
            <Route
              path="/import-history"
              element={isAuthenticated ? <ImportHistory /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/export-history"
              element={isAuthenticated ? <ExportHistory /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/inventory/:id/details"
              element={
                isAuthenticated ? <InventoryDetailPage onLogout={onLogout} /> : <Navigate to="/login" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
