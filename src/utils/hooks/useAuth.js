// utils/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Fetch user and their profile data including role
  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      
      if (user) {
        setUser(user);
        
        // Fetch user profile with role from users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('emp_id, role, department, name')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Check if user is manager
  const isManager = () => {
    return userProfile?.role?.toLowerCase() === 'manager';
  };

  // Check if user is HR
  const isHR = () => {
    return userProfile?.role?.toLowerCase() === 'hr';
  };

  // Check if user is staff
  const isStaff = () => {
    return userProfile?.role?.toLowerCase() === 'staff';
  };

  // Get user's role
  const getUserRole = () => {
    return userProfile?.role || null;
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUserProfile();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
        } else if (event === 'SIGNED_IN' && session) {
          fetchUserProfile();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, supabase.auth]);

  return {
    user,
    userProfile,
    loading,
    error,
    isManager: isManager(),
    isHR: isHR(),
    isStaff: isStaff(),
    role: getUserRole(),
    signOut,
    refreshProfile: fetchUserProfile
  };
};
