import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, Video } from 'lucide-react';
import { DashboardShell } from '../components/DashboardShell';
import { fetchBookings } from '../lib/api/calendar';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

const MONTHS_SV = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

const STATUS_CONFIG = {
    accepted:  { label: 'Bekräftad', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    pending:   { label: 'Väntar',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    cancelled: { label: 'Avbokad',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    declined:  { label: 'Avvisad',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function formatTime(isoString) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Stockholm',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(isoString));
}

function getLocalDateKey(isoString) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(isoString));
}

function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getCalendarDays(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = (firstOfMonth.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= lastOfMonth.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    return days;
}

export function CalendarPage() {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const queryStart = new Date(year, month, 1);
    const queryEnd = new Date(year, month + 1, 1);

    const { data: bookings = [], isLoading, error } = useQuery({
        queryKey: ['calendar-bookings', year, month],
        queryFn: () => fetchBookings(queryStart, queryEnd),
        staleTime: 2 * 60 * 1000,
    });

    const bookingsByDate = useMemo(() => {
        const map = {};
        for (const booking of bookings) {
            const key = getLocalDateKey(booking.startTime);
            if (!map[key]) map[key] = [];
            map[key].push(booking);
        }
        return map;
    }, [bookings]);

    const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

    const todayKey = toDateKey(today);
    const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
    const selectedBookings = selectedKey
        ? [...(bookingsByDate[selectedKey] || [])].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        : [];

    function prevMonth() {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDate(null);
    }

    function nextMonth() {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDate(null);
    }

    function goToToday() {
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(null);
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold text-zinc-100">
                        {MONTHS_SV[month]} {year}
                        {isLoading && <span className="ml-2 text-xs font-normal text-zinc-500">Hämtar...</span>}
                    </h1>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={goToToday}
                            className="text-xs px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            Idag
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-400 py-2">Kunde inte hämta bokningar: {error.message}</p>
                )}

                <div className="border border-primary/10 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-primary/10 bg-zinc-900/40">
                        {WEEKDAYS.map((day) => (
                            <div key={day} className="py-2 text-center text-xs font-medium text-zinc-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, i) => {
                            if (!day) {
                                return (
                                    <div
                                        key={`empty-${i}`}
                                        className="h-16 border-r border-b border-primary/5 bg-zinc-900/20"
                                    />
                                );
                            }

                            const key = toDateKey(day);
                            const isToday = key === todayKey;
                            const isSelected = key === selectedKey;
                            const dayBookings = bookingsByDate[key] || [];
                            const hasBookings = dayBookings.length > 0;

                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedDate(isSelected ? null : day)}
                                    className={`h-16 p-1.5 border-r border-b border-primary/5 text-left transition-colors ${
                                        isSelected
                                            ? 'bg-primary/10'
                                            : 'hover:bg-zinc-800/40'
                                    }`}
                                >
                                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full ${
                                        isToday
                                            ? 'bg-primary text-background'
                                            : isSelected
                                            ? 'text-primary'
                                            : 'text-zinc-400'
                                    }`}>
                                        {day.getDate()}
                                    </span>

                                    {hasBookings && (
                                        <div className="mt-1 flex flex-wrap gap-0.5 pl-0.5">
                                            {dayBookings.slice(0, 3).map((b, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`block h-1.5 w-1.5 rounded-full ${
                                                        b.status === 'accepted' ? 'bg-green-400' :
                                                        b.status === 'pending'  ? 'bg-yellow-400' :
                                                        'bg-red-400'
                                                    }`}
                                                />
                                            ))}
                                            {dayBookings.length > 3 && (
                                                <span className="text-[10px] text-zinc-500 leading-none self-center">
                                                    +{dayBookings.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedDate && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-medium text-zinc-400">
                            {selectedDate.getDate()} {MONTHS_SV[selectedDate.getMonth()].toLowerCase()}
                            {selectedBookings.length === 0 && ' — inga bokningar'}
                        </h2>

                        {selectedBookings.length > 0 && (
                            <div className="space-y-2">
                                {selectedBookings.map((booking) => {
                                    const attendee = booking.attendees?.[0];
                                    const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                                    const meetUrl = booking.metadata?.videoCallUrl;

                                    return (
                                        <div key={booking.uid} className="border border-primary/10 rounded-lg p-4 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-200">
                                                        {attendee?.name || booking.title}
                                                    </p>
                                                    {attendee?.email && (
                                                        <p className="text-xs text-zinc-500 mt-0.5">{attendee.email}</p>
                                                    )}
                                                </div>
                                                <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${statusCfg.color}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                                                </span>
                                                {meetUrl && (
                                                    <a
                                                        href={meetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        <Video className="h-3 w-3" />
                                                        Google Meet
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
