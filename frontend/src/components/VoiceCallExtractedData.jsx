import React from 'react';

function formatList(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.filter(Boolean);
}

export function VoiceCallExtractedData({ extractedData }) {
    if (!extractedData || typeof extractedData !== 'object') return null;

    const painPoints = formatList(extractedData.pain_points);
    const hasContent = Boolean(
        extractedData.person_name ||
        extractedData.company_name ||
        (extractedData.industry && extractedData.industry !== 'Övrigt') ||
        extractedData.email ||
        extractedData.current_process ||
        extractedData.pain_points_summary ||
        (painPoints && painPoints.length > 0) ||
        extractedData.meeting_requested
    );

    if (!hasContent) return null;

    return (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-primary">Uppfattat från samtal</p>

            <div className="grid gap-3 sm:grid-cols-2">
                {extractedData.person_name && (
                    <div>
                        <p className="text-[11px] text-zinc-500 mb-1">Kontaktperson</p>
                        <p className="text-sm text-zinc-200">{extractedData.person_name}</p>
                    </div>
                )}

                {extractedData.company_name && (
                    <div>
                        <p className="text-[11px] text-zinc-500 mb-1">Företag</p>
                        <p className="text-sm text-zinc-200">{extractedData.company_name}</p>
                    </div>
                )}

                {extractedData.industry && extractedData.industry !== 'Övrigt' && (
                    <div>
                        <p className="text-[11px] text-zinc-500 mb-1">Bransch</p>
                        <p className="text-sm text-zinc-200">{extractedData.industry}</p>
                    </div>
                )}

                {extractedData.email && (
                    <div>
                        <p className="text-[11px] text-zinc-500 mb-1">E-post</p>
                        <p className="text-sm text-zinc-200 break-all">{extractedData.email}</p>
                    </div>
                )}
            </div>

            {extractedData.current_process && (
                <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Nuvarande arbetssätt</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{extractedData.current_process}</p>
                </div>
            )}

            {extractedData.pain_points_summary && (
                <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Beskrivet problem</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{extractedData.pain_points_summary}</p>
                </div>
            )}

            {painPoints && painPoints.length > 0 && (
                <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Nyckelområden</p>
                    <div className="flex flex-wrap gap-1.5">
                        {painPoints.map((point) => (
                            <span
                                key={point}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border bg-background/60 text-zinc-300 border-border/50"
                            >
                                {point}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {extractedData.meeting_requested && (
                <div className="pt-1 border-t border-primary/15">
                    <p className="text-xs text-zinc-400">Mötesintresse identifierat i samtalet.</p>
                </div>
            )}
        </div>
    );
}
