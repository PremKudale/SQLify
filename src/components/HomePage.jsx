import React, { useEffect } from 'react';
import '../HomePage.css';
import { Link } from 'react-router-dom';
import EnhancedAnimation from '../components/EnhancedAnimation';

function HomePage() {
  // DatabaseIcon component
  const DatabaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  );

  // CodeIcon component
  const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  );

  // MessageIcon component
  const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  useEffect(() => {
    // Scroll animation function
    const scrollReveal = () => {
      const reveals = document.querySelectorAll('.scroll-reveal');
      
      for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < windowHeight - elementVisible) {
          reveals[i].classList.add('visible');
        } else {
          reveals[i].classList.remove('visible');
        }
      }
    };
    
    // Add scroll event listener
    window.addEventListener('scroll', scrollReveal);
    
    // Initial check
    scrollReveal();
    
    // Clean up
    return () => window.removeEventListener('scroll', scrollReveal);
  }, []);

  return (
    <div className="app">
      <EnhancedAnimation />
      
      {/* Hero Section */}
      <section className="hero">
        <div className="header">
          <div className="logo">
            <DatabaseIcon />
            <span>SQLify</span>
          </div>
          <div className="nav">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#demo">Try It</a>
            <a href="/about">About Us</a>
          </div>
          <Link to="/sql-editor" className="btn primary" style={{ textDecoration: 'none' }}>Get Started</Link>
        </div>

        <div className="hero-content">
          <h1 className="glow-text">Turn English into SQL Queries Instantly</h1>
          <p>Simplify database queries with our AI-powered English to SQL converter.
            No more complex syntax, just plain English.</p>
          <div className="button-group">
            <Link to="/sql-editor" className="btn primary" style={{ textDecoration: 'none' }}>Try For Free</Link>
            <button className="btn secondary">Learn More</button>
          </div>
        </div>

        <div className="hero-demo">
          <div className="code-window">
            <div className="code-header">
              <span className="code-dot"></span>
              <span className="code-dot"></span>
              <span className="code-dot"></span>
            </div>
            <div className="code-content">
              <div className="code-input">
                Show me all users who registered last month with gmail accounts
              </div>
              <div className="code-output">
                <pre>
                  SELECT * FROM users<br />
                  WHERE registration_date BETWEEN DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')<br />
                  AND DATE_TRUNC('month', CURRENT_DATE)<br />
                  AND email LIKE '%gmail.com';
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-header scroll-reveal">
          <h2>Powerful Features</h2>
          <p>Our English to SQL converter comes packed with features that make database querying accessible to everyone.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card scroll-reveal">
            <div className="feature-icon blue">
              <MessageIcon />
            </div>
            <h3>Natural Language Processing</h3>
            <p>Type queries in plain English and get accurate SQL code instantly.</p>
            <div className="feature-button-container">
              <Link to="/sql-editor" className="feature-btn btn primary">
                Try natural Language
              </Link>
            </div>
          </div>

          <div className="feature-card scroll-reveal">
            <div className="feature-icon purple">
              <CodeIcon />
            </div>
            <h3>Connectivity With Multiple Database</h3>
            <p>Connect your queries with database.</p>
            {/* <div className="feature-button-container">
              <Link to="/sql-editor" className="feature-btn btn primary">
                Connect To Database
              </Link>
            </div> */}
          </div>

          <div className="feature-card scroll-reveal">
            <div className="feature-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M4 15.5A2.5 2.5 0 0 1 6.5 13H20"></path>
                <path d="M4 11.5A2.5 2.5 0 0 1 6.5 9H20"></path>
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20"></path>
              </svg>
            </div>
            <h3>Simplified Query Explanation</h3>
            <p>Understand complex SQL queries with easy-to-read explanations.</p>
            <div className="feature-button-container">
              {/* <Link to="/chatbot" className="feature-btn btn primary"> */}
                In Progress...
              {/* </Link> */}
            </div>
          </div>

          <div className="feature-card scroll-reveal">
            <div className="feature-icon red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
              </svg>
            </div>
            <h3>Gamified Learning</h3>
            <p>Enhance your SQL skills with interactive challenges and rewards.</p>
            <div className="feature-button-container">
              <Link to="/game" className="feature-btn btn primary">
                Try Gamified learning
              </Link>
            </div>
          </div>

          <div className="feature-card scroll-reveal">
            <div className="feature-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <h3>Generate Synthetic Data</h3>
            <p>Empower your applications with high-quality, realistic synthetic data—generated seamlessly to train, test, and optimize your models with precision.</p>
            <div className="feature-button-container">
              <Link to="/synthetic-data" className="feature-btn btn primary">
                Generate synthetic data
              </Link>
            </div>
          </div>
          <div className="feature-card scroll-reveal">
            <div className="feature-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <h3>Generate Schema</h3>
            <p>Empower your applications with high-quality, realistic synthetic data—generated seamlessly to train, test, and optimize your models with precision.</p>
            <div className="feature-button-container">
              <Link to="/schema" className="feature-btn btn primary">
              Generate Schema
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Try It Yourself Section */}
      <section id="demo" className="demo">
        <div className="section-header scroll-reveal">
          <h2>Try It Yourself</h2>
          <p>See the magic happen in real-time with our live converter.</p>
        </div>

        <div className="demo-container scroll-reveal">
          <div className="demo-card">
            <div className="form-group">
              <label>Enter your query in English:</label>
              <textarea
                rows="3"
                placeholder="Example: Show me all customers who placed orders last month ordered by total amount"
              ></textarea>
            </div>

            <div className="form-group">
              <Link to="/sql-editor" className="btn primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Convert to SQL
              </Link>
            </div>

            <div className="form-group">
              <label>Generated SQL:</label>
              <div className="code-editor">
                <div className="editor-header">
                  <span>SQL Output</span>
                  <button className="btn small">Copy</button>
                </div>
                <div className="editor-content">
                  <pre>
                    <span className="keyword">SELECT</span> c.customer_name, <span className="function">SUM</span>(o.total_amount) <span className="keyword">as</span> total
                    <span className="keyword">FROM</span> customers c
                    <span className="keyword">JOIN</span> orders o <span className="keyword">ON</span> c.customer_id = o.customer_id
                    <span className="keyword">WHERE</span> o.order_date <span className="keyword">BETWEEN</span> <span className="function">DATE_SUB</span>(<span className="function">CURRENT_DATE</span>(), <span className="keyword">INTERVAL</span> 1 <span className="keyword">MONTH</span>) <span className="keyword">AND</span> <span className="function">CURRENT_DATE</span>()
                    <span className="keyword">GROUP BY</span> c.customer_name
                    <span className="keyword">ORDER BY</span> total <span className="keyword">DESC</span>;
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-content">
          <div className="footer-logo">
            <DatabaseIcon />
            <span>SQLify</span>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#demo">Try It</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
        <div className="copyright">
          <p>© 2025 SQLify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;