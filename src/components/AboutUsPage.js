import { useState } from 'react';
import './AboutUsPage.css';
import EnhancedAnimation from './EnhancedAnimation';

// Custom icon components to replace Lucide icons
const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const ChevronUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const Linkedin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

const Mail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
  </svg>
);

export default function AboutUsPage() {
  const [expandedSection, setExpandedSection] = useState('mission');

  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    
    <div className="page-container">
      <div className="content-wrapper">
        <div className="header">
          <h1 className="title">About SQLify</h1>
          <div className="title-underline"></div>
          <p className="subtitle">
            Simplifying database operations for students and developers alike
          </p>
        </div>
        <EnhancedAnimation />
        <div className="section-card">
          <div className="section-padding">
            <h2 className="section-title">Our Platform</h2>
            <p className="section-text">
              SQLify is a platform designed to simplify SQL-related tasks like query generation, database connectivity, code editing, and data generation. Created with the aim of helping students and developers streamline their database work, SQLify brings together multiple features in a single easy-to-use interface.
            </p>

            <div className="expandable-sections">
              <div className="expandable-item">
                <button
                  className="expandable-header"
                  onClick={() => toggleSection('mission')}
                >
                  <h3 className="expandable-title">Our Mission</h3>
                  <span className="chevron-icon">
                    {expandedSection === 'mission' ? 
                      <ChevronUp /> : 
                      <ChevronDown />
                    }
                  </span>
                </button>
                
                <div className={`expandable-content ${expandedSection === 'mission' ? 'expanded' : ''}`}>
                  <p className="content-paragraph">
                    We noticed that many students and developers struggle with writing SQL queries or setting up databases during learning or development. We created SQLify to make these tasks more accessible, especially for beginners who want to focus more on logic than syntax.
                  </p>
                  <p>
                    Our goal is to empower users by removing technical barriers and allowing them to work with databases more intuitively through natural language processing and smart automation tools.
                  </p>
                </div>
              </div>

              <div className="expandable-item">
                <button
                  className="expandable-header"
                  onClick={() => toggleSection('values')}
                >
                  <h3 className="expandable-title">Our Values</h3>
                  <span className="chevron-icon">
                    {expandedSection === 'values' ? 
                      <ChevronUp /> : 
                      <ChevronDown />
                    }
                  </span>
                </button>
                
                <div className={`expandable-content ${expandedSection === 'values' ? 'expanded' : ''}`}>
                  <ul className="values-list">
                    <li><span className="value-highlight">Accessibility</span> - Making database operations accessible to users of all skill levels</li>
                    <li><span className="value-highlight">Innovation</span> - Constantly improving our technology to provide cutting-edge solutions</li>
                    <li><span className="value-highlight">Education</span> - Supporting learning through practical tools that bridge theoretical knowledge and application</li>
                    <li><span className="value-highlight">Efficiency</span> - Saving valuable development time through automation and intuitive design</li>
                  </ul>
                </div>
              </div>

              <div className="expandable-item">
                <button
                  className="expandable-header"
                  onClick={() => toggleSection('features')}
                >
                  <h3 className="expandable-title">Core Capabilities</h3>
                  <span className="chevron-icon">
                    {expandedSection === 'features' ? 
                      <ChevronUp /> : 
                      <ChevronDown />
                    }
                  </span>
                </button>
                
                <div className={`expandable-content ${expandedSection === 'features' ? 'expanded' : ''}`}>
                  <div className="features-grid">
                    <div className="feature-box">
                      <h4 className="feature-title">Natural Language to SQL</h4>
                      <p>Convert plain English descriptions into precise SQL queries</p>
                    </div>
                    <div className="feature-box">
                      <h4 className="feature-title">Schema Generation</h4>
                      <p>Create database schemas quickly and efficiently</p>
                    </div>
                    <div className="feature-box">
                      <h4 className="feature-title">Synthetic Data</h4>
                      <p>Generate realistic test data for development and testing</p>
                    </div>
                    <div className="feature-box">
                      <h4 className="feature-title">Integrated Environment</h4>
                      <p>All-in-one solution for database management tasks</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-padding">
            <h2 className="section-title team-title">Meet Our Team</h2>
            <div className="team-grid">
              {/* Team Member Card 1 */}
              <div className="team-member">
                <h3 className="member-name">Rohan Langar</h3>
                <p className="member-role"></p>
                <div className="member-social">
                  <a href="https://www.linkedin.com/in/rohan-langar-690202258/" className="social-link">
                    <Linkedin />
                  </a>
                </div>
              </div>

              {/* Team Member Card 2 */}
              <div className="team-member">
                <h3 className="member-name">Likhit Chirmade</h3>
                <p className="member-role"></p>
                <div className="member-social">
                  <a href="#" className="social-link">
                    <Linkedin />
                  </a>
                </div>
              </div>

              {/* Team Member Card 3 */}
              <div className="team-member">
                <h3 className="member-name">Prem Kudale</h3>
                <p className="member-role"></p>
                <div className="member-social">
                  <a href="https://github.com/PremKudale" className="social-link">
                    <Linkedin />
                  </a>
                </div>
              </div>

              {/* Team Member Card 4 */}
              <div className="team-member">
                <h3 className="member-name">Harshad Kedari</h3>
                <p className="member-role"></p>
                <div className="member-social">
                  <a href="https://github.com/Harsh-901" className="social-link">
                    <Linkedin />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-padding">
            <h2 className="section-title">Contact Us</h2>
            <p className="section-text">
              Have questions about SQLify? We'd love to hear from you! Reach out to our team for support, feedback, or partnership opportunities.
            </p>
            
          </div>
        </div>
      </div>
    </div>
  );
}