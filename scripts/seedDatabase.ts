/**
 * Database seeding script
 * Seeds Supabase with series and products from client data
 * 
 * Run with: npx tsx scripts/seedDatabase.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Series configuration from client
const SERIES_DATA = [
  {
    id: 'haemng',
    label: 'Haemng Series',
    use_svg_logo: true,
    logo_src: 'haemng.svg',
    accent: '#ffc812',
    text_on_accent: '#000',
  },
  {
    id: 'maelard',
    label: 'Maelard Series',
    use_svg_logo: true,
    logo_src: 'Maelard.svg',
    accent: '#ffc812',
    text_on_accent: '#000',
  },
  {
    id: 'esc',
    label: 'ESCs',
    use_svg_logo: false,
    accent: '#ffc812',
    text_on_accent: '#000',
  },
  {
    id: 'fc',
    label: 'Flight Controller',
    use_svg_logo: false,
    accent: '#ffc812',
    text_on_accent: '#000',
  },
  {
    id: 'ips',
    label: 'Integrated Power Systems',
    use_svg_logo: false,
    accent: '#ffc812',
    text_on_accent: '#000',
  },
];

// Import all products from client data
// This is a simplified version - in production, you'd import from the actual products.ts file
// eslint-disable-next-line @typescript-eslint/no-require-imports -- one-off script loads a sibling repo's TS file synchronously; static import path is outside this project
const PRODUCTS_DATA = require('../../../WelkinrimTech/src/data/products.ts').PRODUCTS || [];

async function seedSeries() {
  console.log('Seeding series...');
  
  for (const series of SERIES_DATA) {
    const { error } = await supabase
      .from('series')
      .upsert(series, { onConflict: 'id' });
    
    if (error) {
      console.error(`Error seeding series ${series.id}:`, error);
    } else {
      console.log(`✓ Seeded series: ${series.label}`);
    }
  }
}

async function seedProducts() {
  console.log('\nSeeding products...');
  
  for (const product of PRODUCTS_DATA) {
    const { error } = await supabase
      .from('products')
      .upsert(
        {
          id: product.id,
          category: product.category,
          series: product.series,
          model: product.model,
          data: product.data,
        },
        { onConflict: 'id' }
      );
    
    if (error) {
      console.error(`Error seeding product ${product.id}:`, error);
    } else {
      console.log(`✓ Seeded product: ${product.model}`);
    }
  }
}

async function main() {
  console.log('Starting database seed...\n');
  
  try {
    await seedSeries();
    await seedProducts();
    
    console.log('\n✓ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n✗ Database seeding failed:', error);
    process.exit(1);
  }
}

main();
