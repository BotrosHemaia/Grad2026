import { useEffect, useMemo, useState } from 'react'
import type { Reservation, Seat } from '../types/models'
import { TICKET_PRICE_EGP } from '../config/eventConfig'
import {
  bulkCancelReservations,
  bulkConfirmReservations,
  resetAllTestReservationData,
  subscribeToReservations,
} from '../services/reservationService'
import { setVipSeatBlocking, subscribeToSeats } from '../services/seatService'
import {
  getReservationStatus,
  getSeatNumbers,
  indexSeatsById,
} from '../utils/reservationStatus'

type DashboardStatus = 'Pending' | 'Confirmed' | 'Canceled' | 'Unknown'
type FilterStatus = 'All' | 'Pending' | 'Confirmed' | 'Canceled'
type DashboardReservation = Reservation & { status?: DashboardStatus }

const FILTERS: FilterStatus[] = ['All', 'Pending', 'Confirmed', 'Canceled']

const money = new Intl.NumberFormat('en-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0,
})

function formatDate(value: unknown): string {
  const timestamp = value as { toDate?: () => Date } | null
  return timestamp?.toDate ? timestamp.toDate().toLocaleString() : '—'
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function AdminDashboard() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [reservations, setReservations] = useState<DashboardReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('All')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [vipInput, setVipInput] = useState('')
  const [vipWorking, setVipWorking] = useState(false)
  const [resetWorking, setResetWorking] = useState(false)

  useEffect(() => {
    const unsubscribeSeats = subscribeToSeats(
      (data) => {
        setSeats(data)
        setLoading(false)
      },
      () => {
        setError('Could not load the dashboard data.')
        setLoading(false)
      }
    )
    const unsubscribeReservations = subscribeToReservations((data) => {
      setReservations(data)
      setLoading(false)
    })
    return () => {
      unsubscribeSeats()
      unsubscribeReservations()
    }
  }, [])

  const seatsById = useMemo(() => indexSeatsById(seats), [seats])

  const rows = useMemo(
    () =>
      reservations.map((reservation) => {
        const seatNumbers = getSeatNumbers(reservation, seatsById)
        const derivedStatus = getReservationStatus(reservation, seatsById)
        const status: DashboardStatus = reservation.status ?? derivedStatus
        const amount = reservation.seat_ids.length * TICKET_PRICE_EGP
        return { reservation, seatNumbers, status, amount }
      }),
    [reservations, seatsById]
  )

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(({ reservation, seatNumbers, status }) => {
      const matchesFilter = filter === 'All' || status === filter
      const matchesSearch =
        !term ||
        reservation.guest_name.toLowerCase().includes(term) ||
        reservation.phone_number.toLowerCase().includes(term) ||
        seatNumbers.some((seat) => seat.toLowerCase().includes(term))
      return matchesFilter && matchesSearch
    })
  }, [rows, search, filter])

  const analytics = useMemo(() => {
    const active = rows.filter((row) => row.status !== 'Canceled')
    const confirmed = rows.filter((row) => row.status === 'Confirmed')
    const bookedSeats = active.reduce((sum, row) => sum + row.reservation.seat_ids.length, 0)
    const expectedRevenue = active.reduce((sum, row) => sum + row.amount, 0)
    const cashRevenue = active
      .filter((row) => row.reservation.payment_method === 'Cash')
      .reduce((sum, row) => sum + row.amount, 0)
    const instaPayRevenue = active
      .filter((row) => row.reservation.payment_method === 'InstaPay')
      .reduce((sum, row) => sum + row.amount, 0)
    const collectedRevenue = confirmed.reduce((sum, row) => sum + row.amount, 0)
    return {
      bookedSeats,
      availableSeats: seats.filter((seat) => seat.status === 'Available').length,
      expectedRevenue,
      cashRevenue,
      instaPayRevenue,
      collectedRevenue,
    }
  }, [rows, seats])

  const servantLedger = useMemo(() => {
    const ledger = new Map<
      string,
      { reservations: number; seats: number; expected: number; collected: number }
    >()
    rows
      .filter((row) => row.status !== 'Canceled')
      .forEach((row) => {
        const name = row.reservation.servant_name || 'Unassigned'
        const current = ledger.get(name) ?? {
          reservations: 0,
          seats: 0,
          expected: 0,
          collected: 0,
        }
        current.reservations += 1
        current.seats += row.reservation.seat_ids.length
        current.expected += row.amount
        if (row.status === 'Confirmed') current.collected += row.amount
        ledger.set(name, current)
      })
    return [...ledger.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.expected - a.expected)
  }, [rows])

  const visibleIds = filteredRows
    .map(({ reservation }) => reservation.id)
    .filter((id): id is string => Boolean(id))
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const toggleOne = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const selectedRows = rows.filter(
    ({ reservation }) => reservation.id && selectedIds.has(reservation.id)
  )

  const handleBulkConfirm = async () => {
    const invalid = selectedRows.filter((row) => row.status !== 'Pending')
    if (invalid.length > 0) {
      setActionMessage('Only Pending reservations can be bulk confirmed.')
      return
    }
    setBulkWorking(true)
    setActionMessage(null)
    try {
      await bulkConfirmReservations(selectedRows.map((row) => row.reservation))
      setSelectedIds(new Set())
      setActionMessage('Selected reservations were confirmed successfully.')
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Bulk confirmation failed.')
    } finally {
      setBulkWorking(false)
    }
  }

  const handleBulkCancel = async () => {
    const active = selectedRows.filter((row) => row.status !== 'Canceled')
    if (active.length !== selectedRows.length) {
      setActionMessage('Canceled reservations cannot be canceled again.')
      return
    }
    setBulkWorking(true)
    setActionMessage(null)
    try {
      await bulkCancelReservations(active.map((row) => row.reservation))
      setSelectedIds(new Set())
      setActionMessage('Selected reservations were canceled and their seats released.')
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Bulk cancellation failed.')
    } finally {
      setBulkWorking(false)
    }
  }

  const resolveVipSeatIds = (blocked: boolean): string[] => {
    const tokens = vipInput.split(',').map((value) => value.trim()).filter(Boolean)
    if (tokens.length === 0) throw new Error('Enter one or more comma-separated seat labels.')

    return tokens.map((token) => {
      const normalized = token.toLowerCase()
      const matches = seats.filter((seat) => {
        const id = seat.id?.toLowerCase()
        const number = seat.seat_number.toLowerCase()
        return id === normalized || number === normalized || number.endsWith(`-${normalized}`)
      })
      if (matches.length === 0) throw new Error(`Seat "${token}" was not found.`)
      if (matches.length > 1) {
        throw new Error(`Seat "${token}" is ambiguous. Prefix it with Main- or Balcony-.`)
      }
      const seat = matches[0]
      if (!seat.id) throw new Error(`Seat "${token}" has no Firestore document ID.`)
      if (blocked && seat.status !== 'Available') {
        throw new Error(`Seat "${token}" is ${seat.status} and cannot be blocked.`)
      }
      if (!blocked && seat.status !== 'Blocked') {
        throw new Error(`Seat "${token}" is not currently blocked.`)
      }
      return seat.id
    })
  }

  const handleVipUpdate = async (blocked: boolean) => {
    setVipWorking(true)
    setActionMessage(null)
    try {
      await setVipSeatBlocking(resolveVipSeatIds(blocked), blocked)
      setVipInput('')
      setActionMessage(blocked ? 'VIP seats blocked successfully.' : 'VIP seats unblocked successfully.')
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'VIP seat update failed.')
    } finally {
      setVipWorking(false)
    }
  }

  const handleResetAllTestData = async () => {
    const confirmation = window.prompt(
      'DANGER: This permanently deletes every reservation and releases all Pending/Confirmed seats. ' +
        'Blocked VIP seats will remain blocked. Type DELETE to continue.'
    )
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) setActionMessage('Reset canceled: confirmation text did not match DELETE.')
      return
    }

    setResetWorking(true)
    setActionMessage(null)
    try {
      const result = await resetAllTestReservationData()
      setSelectedIds(new Set())
      setActionMessage(
        `Reset complete: ${result.deletedReservations} reservations deleted and ` +
          `${result.releasedSeats} seats released. Blocked VIP seats were preserved.`
      )
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Failed to reset test data.')
    } finally {
      setResetWorking(false)
    }
  }

  const downloadCsv = () => {
    const header = ['Guest', 'Phone', 'Seats', 'Payment', 'Servant', 'Status', 'Amount EGP', 'Created']
    const body = filteredRows.map(({ reservation, seatNumbers, status, amount }) => [
      reservation.guest_name,
      reservation.phone_number,
      seatNumbers.join(', '),
      reservation.payment_method,
      reservation.servant_name,
      status,
      amount,
      formatDate(reservation.created_at),
    ])
    const csv = [header, ...body].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const statusClasses: Record<DashboardStatus, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Canceled: 'bg-red-100 text-red-700',
    Unknown: 'bg-gray-100 text-gray-700',
  }

  if (loading) {
    return <div className="py-20 text-center text-gray-500">Loading dashboard…</div>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-600">Reservations</p>
            <h1 className="font-display text-3xl font-bold text-navy-900">Admin Dashboard</h1>
          </div>
          <p className="rounded-lg bg-white px-3 py-2 text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">
            Ticket price: <strong className="text-navy-900">{money.format(TICKET_PRICE_EGP)}</strong>
          </p>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Reservation analytics">
          <KpiCard label="Total Booked Seats" value={analytics.bookedSeats.toLocaleString()} icon="fa-chair" />
          <KpiCard label="Available Seats" value={analytics.availableSeats.toLocaleString()} icon="fa-circle-check" />
          <KpiCard label="Expected Revenue" value={money.format(analytics.expectedRevenue)} icon="fa-chart-line" />
          <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-md">
            <p className="text-sm text-navy-100/70">Revenue by payment method</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div><p className="text-xs text-navy-100/60">Cash</p><p className="text-lg font-bold">{money.format(analytics.cashRevenue)}</p></div>
              <div className="text-right"><p className="text-xs text-navy-100/60">InstaPay</p><p className="text-lg font-bold text-gold-400">{money.format(analytics.instaPayRevenue)}</p></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-bold text-navy-900">Servants Ledger</h2><p className="text-sm text-gray-500">Confirmed collections: {money.format(analytics.collectedRevenue)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-600"><th className="px-4 py-3">Servant</th><th className="px-4 py-3">Reservations</th><th className="px-4 py-3">Seats</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Collected</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {servantLedger.map((item) => <tr key={item.name}><td className="px-4 py-3 font-semibold text-navy-900">{item.name}</td><td className="px-4 py-3">{item.reservations}</td><td className="px-4 py-3">{item.seats}</td><td className="px-4 py-3 font-medium">{money.format(item.expected)}</td><td className="px-4 py-3 font-bold text-emerald-700">{money.format(item.collected)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-navy-900">VIP Seat Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter comma-separated seat labels. Use Main- or Balcony- when a label exists in both sections.
              </p>
              <label htmlFor="vip-seat-input" className="mt-3 block text-sm font-semibold text-navy-700">Seat labels</label>
              <input
                id="vip-seat-input"
                value={vipInput}
                onChange={(event) => setVipInput(event.target.value)}
                placeholder="Main-AR-1, Main-AL-2, Balcony-FL-5"
                disabled={vipWorking}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleVipUpdate(true)} disabled={vipWorking || !vipInput.trim()} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Block VIP Seats</button>
              <button type="button" onClick={() => handleVipUpdate(false)} disabled={vipWorking || !vipInput.trim()} className="rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40">Unblock</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-navy-900">Reservations</h2><p className="text-sm text-gray-500">{filteredRows.length} matching records</p></div>
            <button type="button" onClick={downloadCsv} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"><i className="fas fa-download mr-2" />Download CSV</button>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl"><i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guest, phone, or seat…" className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200" /></div>
            <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{item}</button>)}</div>
          </div>

          {actionMessage && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{actionMessage}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 p-3">
            <span className="mr-auto text-sm font-medium text-navy-700">{selectedIds.size} selected</span>
            <button type="button" onClick={handleBulkConfirm} disabled={!selectedIds.size || bulkWorking} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirm Selected</button>
            <button type="button" onClick={handleBulkCancel} disabled={!selectedIds.size || bulkWorking} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Cancel Selected</button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-gray-200">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible reservations" /></th><th className="px-4 py-3">Guest</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Seats</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Servant</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map(({ reservation, seatNumbers, status, amount }) => reservation.id && <tr key={reservation.id} className={selectedIds.has(reservation.id) ? 'bg-gold-50' : 'hover:bg-gray-50'}><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(reservation.id)} onChange={() => toggleOne(reservation.id!)} aria-label={`Select ${reservation.guest_name}`} /></td><td className="px-4 py-3 font-semibold text-navy-900">{reservation.guest_name}</td><td className="px-4 py-3 whitespace-nowrap text-gray-600">{reservation.phone_number}</td><td className="px-4 py-3 font-medium text-gray-700">{seatNumbers.join(', ')}</td><td className="px-4 py-3">{reservation.payment_method}</td><td className="px-4 py-3">{reservation.servant_name}</td><td className="px-4 py-3 font-bold">{money.format(amount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>{status}</span></td><td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(reservation.created_at)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 shadow-sm" aria-labelledby="danger-zone-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="danger-zone-title" className="text-lg font-bold text-red-800">Danger Zone</h2>
              <p className="mt-1 max-w-3xl text-sm text-red-700">
                Permanently delete every test reservation and release Pending or Confirmed seats.
                VIP seats marked Blocked will remain blocked.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetAllTestData}
              disabled={resetWorking}
              className="shrink-0 rounded-lg bg-red-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetWorking ? 'Deleting Test Data…' : 'Delete All Test Reservations'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"><div className="flex items-start justify-between"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-navy-900">{value}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><i className={`fas ${icon}`} /></span></div></div>
}
