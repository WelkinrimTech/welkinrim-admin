import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 300; // Revalidate every 5 minutes

/**
 * GET /api/series
 * Public API endpoint for client website to fetch series configuration
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching series:', error);
      return NextResponse.json(
        { error: 'Failed to fetch series' },
        { status: 500 }
      );
    }

    // Transform to client format
    const seriesConfig: Record<string, {
      label: string;
      useSvgLogo: boolean;
      logoSrc: string | null;
      accent: string;
      textOnAccent: string;
      iconUrl: string | null;
    }> = {};
    data.forEach((s) => {
      seriesConfig[s.id] = {
        label: s.label,
        useSvgLogo: s.use_svg_logo,
        logoSrc: s.logo_src,
        accent: s.accent,
        textOnAccent: s.text_on_accent,
        iconUrl: s.icon_url,
      };
    });

    return NextResponse.json(
      { series: seriesConfig },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
