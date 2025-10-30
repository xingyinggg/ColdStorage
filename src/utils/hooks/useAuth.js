// utils/hooks/useAuth.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

const CACHE_KEY = 'user_profile_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const useAuth = () => {
  // Initialize state synchronously from cache to avoid first-render flicker on remounts
  let initialUser = null;
  let initialProfile = null;
  let initialLoading = true;
  let initialFetched = false;

  if (typeof window !== 'undefined') {
    // E2E: if flagged, provide a fake authenticated user/profile
    try {
      const e2eFlag = window.localStorage?.getItem('e2e_auth');
      if (e2eFlag === '1') {
        // Try to get custom profile from localStorage if set
        const e2eProfileData = window.localStorage?.getItem('e2e_user_profile');
        const customProfile = e2eProfileData ? JSON.parse(e2eProfileData) : null;
        
        initialUser = { id: 'mock-user-123', email: 'mock@example.com' };
        initialProfile = customProfile || {
          emp_id: 'E2E001',
          role: 'staff',
          department: 'QA',
          name: 'E2E Tester'
        };
        initialLoading = false;
        initialFetched = true;
      }
    } catch {}

    // Only try cache if not in E2E mode
    if (!initialFetched) {
      try {
        const cachedData = sessionStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { user: cachedUser, profile: cachedProfile, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          if (now - timestamp < CACHE_DURATION && cachedUser && cachedProfile) {
            initialUser = cachedUser;
            initialProfile = cachedProfile;
            initialLoading = false;
            initialFetched = true;
          }
        }
      } catch {
        // Ignore cache parse errors and fall back to defaults
      }
    }
  }

  const [user, setUser] = useState(initialUser);
  const [userProfile, setUserProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(null);
  
  // Create supabase client (or mock in E2E mode)
  const supabaseRef = useRef(
    typeof window !== 'undefined' && window.localStorage?.getItem('e2e_auth') === '1'
      ? null // Will be handled by E2E mock
      : createClient()
  );
  
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(initialFetched);

  // Fetch user and their profile data including role
  const fetchUserProfile = useCallback(async (skipLoadingState = false) => {
    console.log('🔄 useAuth: fetchUserProfile called');
    
    // Skip fetch in E2E mode - we already have the data
    if (typeof window !== 'undefined' && window.localStorage?.getItem('e2e_auth') === '1') {
      console.log('✓ useAuth: E2E mode detected, skipping fetchUserProfile');
      return;
    }
    
    try {
      // Only set loading state if we don't have cached data
      if (!skipLoadingState && !hasFetchedRef.current) {
        setLoading(true);
      }
      
      const { data: { user }, error: authError } = await supabaseRef.current.auth.getUser();
      
      if (authError) throw authError;
      
      if (user && isMountedRef.current) {
        console.log('✓ useAuth: Got user from Supabase, id:', user.id);
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
          hasFetchedRef.current = true;
          
          // Cache the results - ensure we have both user and profile
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            user,
            profile,
            timestamp: Date.now()
          }));
          
          console.log('✓ useAuth: User profile loaded:', profile.role, 'emp_id:', profile.emp_id);
        }
      } else if (isMountedRef.current) {
        console.log('⚠️ useAuth: No user found in Supabase');
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
    // In E2E mode, just clear state
    if (typeof window !== 'undefined' && window.localStorage?.getItem('e2e_auth') === '1') {
      if (isMountedRef.current) {
        setUser(null);
        setUserProfile(null);
        sessionStorage.removeItem(CACHE_KEY);
        sessionStorage.removeItem('tasks_ever_loaded');
        sessionStorage.removeItem('projects_ever_loaded');
      }
      return;
    }
    
    try {
      const { error } = await supabaseRef.current.auth.signOut();
      if (error) throw error;
      if (isMountedRef.current) {
        setUser(null);
        setUserProfile(null);
        sessionStorage.removeItem(CACHE_KEY);
        // Clear the "ever loaded" flags so next sign-in shows loading spinner
        sessionStorage.removeItem('tasks_ever_loaded');
        sessionStorage.removeItem('projects_ever_loaded');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Skip setup in E2E mode
    if (typeof window !== 'undefined' && window.localStorage?.getItem('e2e_auth') === '1') {
      console.log('✓ useAuth: E2E mode, skipping auth subscription');
      return () => {
        isMountedRef.current = false;
      };
    }
    
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
            sessionStorage.removeItem('tasks_ever_loaded');
            sessionStorage.removeItem('projects_ever_loaded');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - fetchUserProfile is stable with useCallback

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
