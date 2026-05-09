import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: latestReport } = await supabase
    .from('reports')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestReport) return;

  const { data, error } = await supabase
    .from('report_events')
    .select('*')
    .eq('report_id', latestReport.id);
    
  if (error) {
    console.error("DB error:", error);
  } else {
    console.log("Events for latest report:", JSON.stringify(data, null, 2));
  }
}
run();
