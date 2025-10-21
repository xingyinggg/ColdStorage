// utils/hooks/useAuth.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

const CACHE_KEY = 'user_profile_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Load from cache immediately
  useEffect(() => {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const { user: cachedUser, profile: cachedProfile, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION) {
          setUser(cachedUser);
          setUserProfile(cachedProfile);
          setLoading(false);
          hasFetchedRef.current = true; // Mark as having valid data
        }
      } catch (err) {
        console.error("Error loading auth cache:", err);
      }
    }
  }, []);

  // Fetch user and their profile data including role
  const fetchUserProfile = useCallback(async (skipLoadingState = false) => {
    try {
      // Only set loading state if we don't have cached data
      if (!skipLoadingState && !hasFetchedRef.current) {
        setLoading(true);
      }
      
      const { data: { user }, error: authError } = await supabaseRef.current.auth.getUser();
      
      if (authError) throw authError;
      
      if (user && isMountedRef.current) {
        setUser(user);
        
        // Fetch user profile with role from users table
        const { data: profile, error: profileError } = await supabaseRef.current
          .from('users')
          .select('emp_id, role, department, name')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        
        if (isMountedRef.current) {
          setUserProfile(profile);
          
          // Cache the results
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            user,
            profile,
            timestamp: Date.now()
          }));
        }
      } else if (isMountedRef.current) {
        setUser(null);
        setUserProfile(null);
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current && !skipLoadingState) {
        setLoading(false);
      }
    }
  }, []);

  // Memoize role checks to avoid creating new boolean values on every render
  const isManager = useMemo(() => userProfile?.role?.toLowerCase() === 'manager', [userProfile?.role]);
  const isHR = useMemo(() => userProfile?.role?.toLowerCase() === 'hr', [userProfile?.role]);
  const isDirector = useMemo(() => userProfile?.role?.toLowerCase() === 'director', [userProfile?.role]);
  const isStaff = useMemo(() => userProfile?.role?.toLowerCase() === 'staff', [userProfile?.role]);
  const role = useMemo(() => userProfile?.role || null, [userProfile?.role]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabaseRef.current.auth.signOut();
      if (error) throw error;
      if (isMountedRef.current) {
        setUser(null);
        setUserProfile(null);
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch if we don't have valid cached data
    if (!hasFetchedRef.current) {
      fetchUserProfile();
    }

    // Listen for auth changes
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (isMountedRef.current) {
            setUser(null);
            setUserProfile(null);
            sessionStorage.removeItem(CACHE_KEY);
            hasFetchedRef.current = false;
          }
        } else if (event === 'SIGNED_IN' && session) {
          hasFetchedRef.current = false; // Force re-fetch on sign in
          fetchUserProfile();
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  return {
    user,
    userProfile,
    loading,
    error,
    isManager,
    isHR,
    isDirector,
    isStaff,
    role,
    signOut,
    refreshProfile: fetchUserProfile
  };
};
