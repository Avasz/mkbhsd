// Leaderboard Module using Supabase

// TODO: REPLACE THIS WITH YOUR SUPABASE CONFIGURATION
// 1. Go to https://supabase.com/dashboard
// 2. Create a new project
// 3. Go to Project Settings -> API
// 4. Copy the 'Project URL' and 'anon' public key
const supabaseUrl = 'https://pkuburddbuwfioqhjrwv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWJ1cmRkYnV3ZmlvcWhqcnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODc4NzMsImV4cCI6MjA3OTQ2Mzg3M30.Cr5dZ0zvk3IF0hmYwXF_adtR8VRW7TtIi5PX7jfhwpc';

// Initialize Supabase
let supabase;

try {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log("Supabase initialized successfully");
    } else {
        console.warn("Supabase SDK not loaded. Leaderboard disabled.");
    }
} catch (e) {
    console.warn("Error initializing Supabase:", e);
}

const Leaderboard = {
    // Fetch top 5 scores
    getTopScores: async function () {
        console.log("Fetching top scores...");
        if (!supabase) {
            console.error("Supabase client not ready");
            return [];
        }
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(5);

            if (error) throw error;
            console.log("Scores fetched:", data);
            return data;
        } catch (e) {
            console.error("Error fetching scores:", e);
            return [];
        }
    },

    // Check if a score qualifies for top 5
    isHighScore: async function (score) {
        if (!supabase) return false;
        try {
            const topScores = await this.getTopScores();
            if (topScores.length < 5) return true;
            return score > topScores[topScores.length - 1].score;
        } catch (e) {
            console.error("Error checking high score:", e);
            return false;
        }
    },

    // Save a new score
    saveScore: async function (name, score) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('scores')
                .insert([
                    { name: name.substring(0, 10), score: parseInt(score) }
                ]);

            if (error) throw error;
            console.log("Score saved!");
        } catch (e) {
            console.error("Error saving score:", e);
        }
    },

    // Render the leaderboard to the DOM
    render: async function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<p>Loading scores...</p>';

        const scores = await this.getTopScores();

        if (scores.length === 0) {
            container.innerHTML = '<p>No scores yet.</p>';
            return;
        }

        let html = '<h3>Top 5 High Scores</h3><ol>';
        scores.forEach(entry => {
            html += `<li>${entry.name}: ${entry.score}</li>`;
        });
        html += '</ol>';
        container.innerHTML = html;
    }
};

// Expose to global scope
window.Leaderboard = Leaderboard;
