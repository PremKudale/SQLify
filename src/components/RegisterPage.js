import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useSession } from '../SessionContext';
import './AuthForm.css';

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [focusedField, setFocusedField] = useState(null);
    const navigate = useNavigate();
    const { session } = useSession();
    
    // Redirect if already logged in
    useEffect(() => {
        if (session && session.user) {
            navigate('/home');
        }
    }, [session, navigate]);
    
    // Add animation class when component mounts
    useEffect(() => {
        document.body.classList.add('auth-page-loaded');
        
        return () => {
            document.body.classList.remove('auth-page-loaded');
        };
    }, []);

    const handleFocus = (field) => {
        setFocusedField(field);
    };

    const handleBlur = () => {
        setFocusedField(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        // Password validation
        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }
        
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        
        setLoading(true);
        
        // Add animation on button press
        document.querySelector('.auth-box').classList.add('auth-box-submitting');
        
        try {
            const { data, error } = await supabase.auth.signUp({ email, password });

            if (error) {
                setError(error.message);
            } else if (data?.user) {
                setSuccess('Registration successful! Please check your email for confirmation.');
                document.querySelector('.auth-box').classList.add('auth-success');
                
                setTimeout(() => {
                    navigate('/login');
                }, 2500);
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
            setTimeout(() => {
                document.querySelector('.auth-box').classList.remove('auth-box-submitting');
            }, 400);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <div className="auth-left">
                    <h2>Join Us!</h2>
                    <p>Create an account to start your journey and unlock all features.</p>
                </div>
                <div className="auth-right">
                    <h2>Create Account</h2>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className={`form-group ${focusedField === 'email' ? 'focused' : ''}`}>
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onFocus={() => handleFocus('email')}
                                onBlur={handleBlur}
                                required
                            />
                        </div>
                        <div className={`form-group ${focusedField === 'password' ? 'focused' : ''}`}>
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => handleFocus('password')}
                                onBlur={handleBlur}
                                required
                            />
                        </div>
                        <div className={`form-group ${focusedField === 'confirmPassword' ? 'focused' : ''}`}>
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onFocus={() => handleFocus('confirmPassword')}
                                onBlur={handleBlur}
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="auth-button">
                            {loading ? (
                                <>
                                    <span className="button-spinner"></span>
                                    Creating Account...
                                </>
                            ) : 'CREATE ACCOUNT'}
                        </button>
                    </form>
                    <div className="switch-link" onClick={() => navigate('/login')}>
                        Already have an account? <span>Sign In</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;