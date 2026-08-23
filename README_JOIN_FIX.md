# v1.4.4 Join Fix

Room joining no longer depends on the Supabase participant-count update succeeding first. The app enters the LiveKit meeting immediately after selecting a valid active room, then synchronizes the participant counter in the background. This prevents a temporary Supabase update/RLS/network issue from blocking users from joining.
