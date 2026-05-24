const CAL_BASE = 'https://api.cal.com/v2';

export async function fetchBookings(start, end) {
    const params = new URLSearchParams({
        afterStart: start.toISOString(),
        beforeStart: end.toISOString(),
        take: '100',
    });

    const res = await fetch(`${CAL_BASE}/bookings?${params}`, {
        headers: {
            Authorization: `Bearer ${process.env.REACT_APP_CAL_API_KEY}`,
            'cal-api-version': '2024-08-13',
        },
    });

    if (!res.ok) throw new Error(`Cal.com API ${res.status}`);
    const json = await res.json();
    // v2 returns either data: [...] or data: { bookings: [...] }
    const raw = json.data;
    return Array.isArray(raw) ? raw : (raw?.bookings || []);
}
