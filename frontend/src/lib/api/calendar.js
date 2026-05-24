const CAL_BASE = 'https://api.cal.com/v2';

async function calFetch(params) {
    const res = await fetch(`${CAL_BASE}/bookings?${params}`, {
        headers: {
            Authorization: `Bearer ${process.env.REACT_APP_CAL_API_KEY}`,
            'cal-api-version': '2024-08-13',
        },
    });
    if (!res.ok) throw new Error(`Cal.com API ${res.status}`);
    const json = await res.json();
    const raw = json.data;
    return Array.isArray(raw) ? raw : (raw?.bookings || []);
}

export function fetchBookings(start, end) {
    return calFetch(new URLSearchParams({
        afterStart: start.toISOString(),
        beforeStart: end.toISOString(),
        take: '100',
    }));
}

export function fetchBookingsByEmail(email) {
    return calFetch(new URLSearchParams({
        attendeeEmail: email,
        take: '10',
    }));
}
