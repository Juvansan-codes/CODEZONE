import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: matches } = await supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(5);
    console.log('Matches:', matches);

    const { data: profiles } = await supabase.from('profiles').select('username, total_wins, total_matches, xp, coins');
    console.log('Profiles:', profiles);

    const { data: history } = await supabase.from('match_history').select('*').limit(5);
    console.log('Match History:', history);
}

test();
