import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useSession } from '../SessionContext';
import './AuthForm.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [focusedField, setFocusedField] = useState(null);
    const navigate = useNavigate();
    const { session } = useSession();
    
    useEffect(() => {
        // Only redirect if session exists and is confirmed valid
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
        setLoading(true);
        
        // Add animation on button press
        document.querySelector('.auth-box').classList.add('auth-box-submitting');
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                setError(error.message);
            } else if (data?.user) {
                setSuccess('Login successful! Redirecting you...');
                document.querySelector('.auth-box').classList.add('auth-success');
            } else {
                setError('Login failed. Please try again.');
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
                    <h2>Welcome Back!</h2>
                    <p>Sign in to access your account and continue your journey with us.</p>
                </div>
                <div className="auth-right">
                    <h2>Sign In</h2>
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
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => handleFocus('password')}
                                onBlur={handleBlur}
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="auth-button">
                            {loading ? (
                                <>
                                    <span className="button-spinner"></span>
                                    Signing In...
                                </>
                            ) : 'SIGN IN'}
                        </button>
                    </form>
                    <div className="switch-link" onClick={() => navigate('/register')}>
                        Don't have an account? <span>Register</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;