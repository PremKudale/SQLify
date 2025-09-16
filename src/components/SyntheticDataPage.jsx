import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../SyntheticDataPage.css'; // Reusing existing styles
import EnhancedAnimation from './EnhancedAnimation';

function SyntheticDataPage() {
  const [schemaInput, setSchemaInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDbType, setSelectedDbType] = useState('mysql');
  const [showDbConnection, setShowDbConnection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [dbConfig, setDbConfig] = useState({
    host: "localhost",
    user: "root",
    password: "",
    database: "",
    port: ""
  });
  const [generationResults, setGenerationResults] = useState(null);

  // Database options with logos
  const databaseOptions = [
    { id: 'mysql', name: 'MySQL', logo: '🐬' },
    { id: 'postgresql', name: 'PostgreSQL', logo: '🐘' },
    { id: 'postgres', name: 'PostgreSQL', logo: '🐘' },
    { id: 'oracle', name: 'Oracle', logo: '🔴' },
    { id: 'sqlserver', name: 'SQL Server', logo: '🔷' },
    { id: 'mongodb', name: 'MongoDB', logo: '🍃' },
    { id: 'trino', name: 'Trino', logo: '🔺' },
    { id: 'clickhouse', name: 'ClickHouse', logo: '🟡' },
    { id: 'sqlite', name: 'SQLite', logo: '🔋' },
    { id: 'mariadb', name: 'MariaDB', logo: 'M' }
  ];

  // Example schemas for different database types
  const exampleSchemas = {
    mysql: `{
  "tableName": "users",
  "columns": [
    { "name": "id", "type": "int", "autoIncrement": true },
    { "name": "name", "type": "string", "options": { "min": 3, "max": 30 } },
    { "name": "email", "type": "email" },
    { "name": "created_at", "type": "date", "options": { "past": true } }
  ],
  "count": 100
}`,
    postgresql: `{
  "tableName": "products",
  "columns": [
    { "name": "product_id", "type": "uuid" },
    { "name": "product_name", "type": "string", "options": { "min": 5, "max": 50 } },
    { "name": "price", "type": "decimal", "options": { "min": 1, "max": 999.99 } },
    { "name": "stock", "type": "int", "options": { "min": 0, "max": 1000 } },
    { "name": "updated_at", "type": "timestamp" }
  ],
  "count": 100
}`,
    mongodb: `{
  "tableName": "customers",
  "columns": [
    { "name": "_id", "type": "objectId" },
    { "name": "fullName", "type": "string", "options": { "min": 5, "max": 40 } },
    { "name": "address", "type": "object", "options": { 
        "structure": {
          "street": "string",
          "city": "string",
          "zipCode": "string",
          "country": "string"
        }
    }},
    { "name": "phoneNumber", "type": "phone" },
    { "name": "registrationDate", "type": "date" }
  ],
  "count": 100
}`,
    sqlserver: `{
  "tableName": "orders",
  "columns": [
    { "name": "order_id", "type": "int", "autoIncrement": true },
    { "name": "customer_id", "type": "int" },
    { "name": "order_date", "type": "datetime" },
    { "name": "total_amount", "type": "money" },
    { "name": "status", "type": "enum", "options": { "values": ["Pending", "Processing", "Shipped", "Delivered"] } }
  ],
  "count": 100
}`,
    sqlite: `{
  "tableName": "tasks",
  "columns": [
    { "name": "task_id", "type": "integer", "autoIncrement": true },
    { "name": "title", "type": "text", "options": { "min": 3, "max": 50 } },
    { "name": "description", "type": "text", "options": { "min": 10, "max": 200, "nullable": true } },
    { "name": "is_completed", "type": "boolean", "options": { "weightTrue": 0.3 } },
    { "name": "due_date", "type": "text" }
  ],
  "count": 100
}`
  };

  // Get the appropriate example schema based on DB type
  const getExampleSchema = (dbType) => {
    if (dbType === 'postgres') dbType = 'postgresql';
    if (dbType === 'mariadb') dbType = 'mysql';
    
    return exampleSchemas[dbType] || exampleSchemas.mysql;
  };

  // DatabaseIcon component (reused from HomePage)
  const DatabaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  );

  // Handle database type selection
  const handleDbTypeChange = (e) => {
    const newDbType = e.target.value;
    setSelectedDbType(newDbType);
    
    // Update the schema input with an example for the selected database
    if (schemaInput === '' || window.confirm("Do you want to update the schema with an example for the selected database?")) {
      setSchemaInput(getExampleSchema(newDbType));
    }
    
    // Set default ports and settings based on selected DB
    switch(newDbType) {
      case 'mysql':
        setDbConfig(prev => ({...prev, host: "localhost", port: "3306"}));
        break;
      case 'postgresql':
      case 'postgres':
        setDbConfig(prev => ({...prev, host: "localhost", port: "5432"}));
        break;
      case 'oracle':
        setDbConfig(prev => ({...prev, host: "localhost", port: "1521"}));
        break;
      case 'sqlserver':
        setDbConfig(prev => ({...prev, host: "localhost", port: "1433"}));
        break;
      case 'mongodb':
        setDbConfig(prev => ({...prev, host: "localhost", port: "27017"}));
        break;
      case 'trino':
        setDbConfig(prev => ({...prev, host: "localhost", port: "8080"}));
        break;
      case 'clickhouse':
        setDbConfig(prev => ({...prev, host: "localhost", port: "9000"}));
        break;
      case 'sqlite':
        setDbConfig(prev => ({...prev, host: "local", port: ""}));
        break;
      case 'mariadb':
        setDbConfig(prev => ({...prev, host: "localhost", port: "3306"}));
        break;
      default:
        setDbConfig(prev => ({...prev, host: "localhost", port: ""}));
    }
  };

  // Handle db config change
  const handleDbConfigChange = (e) => {
    const { name, value } = e.target;
    setDbConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Connect to database
  const handleConnectToDb = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      // Validate connection details
      if (!dbConfig.host) {
        throw new Error("Host is required");
      }
      
      if (!dbConfig.user && selectedDbType !== 'sqlite') {
        throw new Error("User is required");
      }
      
      if (!dbConfig.database && selectedDbType !== 'mongodb') {
        throw new Error("Database name is required");
      }
      
      const response = await fetch("https://sqlify-backend-2.onrender.com/connect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: dbConfig.host,
          user: dbConfig.user,
          password: dbConfig.password,
          database: dbConfig.database,
          port: dbConfig.port,
          dbType: selectedDbType
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Connection error: ${data.error}`);
      } else {
        setSuccessMessage(`${databaseOptions.find(db => db.id === selectedDbType).name} database connected successfully!`);
        setShowDbConnection(false);
        setIsConnected(true);
        
        // Reset generation results when connecting to a new DB
        setGenerationResults(null);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to database. Please check your connection.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Validate JSON schema
  const validateSchema = (schema) => {
    if (!schema.tableName) {
      throw new Error("Schema must include a tableName");
    }
    
    if (!schema.columns || !Array.isArray(schema.columns) || schema.columns.length === 0) {
      throw new Error("Schema must include at least one column");
    }
    
    for (const column of schema.columns) {
      if (!column.name) {
        throw new Error("Each column must have a name");
      }
      if (!column.type) {
        throw new Error("Each column must have a type");
      }
    }
    
    if (schema.count && (!Number.isInteger(schema.count) || schema.count <= 0)) {
      throw new Error("Count must be a positive integer");
    }
    
    return true;
  };

  // Function to handle form submission
  const handleGenerateData = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSuccessMessage('');
    setGenerationResults(null);
    
    try {
      if (!isConnected) {
        throw new Error("Please connect to a database first.");
      }
      
      // Parse the schema input
      let schemaData;
      try {
        schemaData = JSON.parse(schemaInput);
      } catch (err) {
        throw new Error("Invalid JSON schema format. Please check your input.");
      }
      
      // Validate the schema structure
      validateSchema(schemaData);
      
      // Make the API call to generate data
      const response = await fetch("https://sqlify-backend-2.onrender.com/generate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: schemaData,
          dbConfig: {
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            port: dbConfig.port,
            dbType: selectedDbType
          }
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Error: ${data.error}`);
      } else {
        setSuccessMessage(`Successfully generated ${data.records_inserted} rows of data in the "${data.table_name}" table.`);
        setGenerationResults(data);
      }
    } catch (err) {
      setError(err.message || "Failed to generate data. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Load example schema when component mounts
  useEffect(() => {
    if (schemaInput === '') {
      setSchemaInput(getExampleSchema(selectedDbType));
    }
  }, []);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // Scroll animation function (reused from HomePage)
    const scrollReveal = () => {
      const reveals = document.querySelectorAll('.scroll-reveal');
      
      for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < windowHeight - elementVisible) {
          reveals[i].classList.add('visible');
        }
      }
    };
    
    // Initial check
    scrollReveal();
    
    // Add scroll event listener
    window.addEventListener('scroll', scrollReveal);
    
    // Clean up
    return () => window.removeEventListener('scroll', scrollReveal);
  }, []);

  return (
    <div className="app1">
      <EnhancedAnimation />
      
      {/* Database Connection Modal */}
      {showDbConnection && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Connect to {databaseOptions.find(db => db.id === selectedDbType)?.name}</h3>
              <button 
                className="close-button"
                onClick={() => setShowDbConnection(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Host:</label>
                <input
                  type="text"
                  name="host"
                  value={dbConfig.host}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  required
                />
              </div>
              <div className="form-group">
                <label>Port:</label>
                <input
                  type="text"
                  name="port"
                  value={dbConfig.port || ""}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  placeholder={`Default port for ${selectedDbType}`}
                />
              </div>
              <div className="form-group">
                <label>User:</label>
                <input
                  type="text"
                  name="user"
                  value={dbConfig.user}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  required={selectedDbType !== 'sqlite'}
                />
                {selectedDbType === 'sqlite' && (
                  <div className="note">Not required for SQLite</div>
                )}
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  name="password"
                  value={dbConfig.password}
                  onChange={handleDbConfigChange}
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>Database:</label>
                <input
                  type="text"
                  name="database"
                  value={dbConfig.database}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  placeholder={selectedDbType === 'sqlite' ? "Path to SQLite file" : "Database name"}
                  required={selectedDbType !== 'mongodb'}
                />
                {selectedDbType === 'mongodb' && (
                  <div className="note">Optional for MongoDB</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn secondary"
                onClick={() => setShowDbConnection(false)}
              >
                Cancel
              </button>
              <button 
                className="btn primary glow-effect"
                onClick={handleConnectToDb}
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header - Fixed position */}
      <header className="header">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <DatabaseIcon />
          <span>SQLify</span>
        </Link>
        <div className="nav">
          <Link to="/homepage">Home</Link>
          <Link to="/#how-it-works">How It Works</Link>
          <Link to="/#demo">Try It</Link>
        </div>
        <Link to="/sql-editor" className="btn primary" style={{ textDecoration: 'none' }}>SQL Editor</Link>
      </header>

      {/* Main content container */}
      <main className="main-content">
        <section className="features">
          <div className="section-header scroll-reveal">
            <h1 className="glow-text">Generate Synthetic Data in One Click</h1>
            <p>Create realistic test data instantly by providing your schema or JSON format below.</p>
          </div>

          <div className="demo-container scroll-reveal" style={{ width: '100%', maxWidth: '800px', margin: '20px auto' }}>
            <div className="demo-card">
              {/* Database Connection Status */}
              <div className="db-connection-status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <button 
                    className={`btn ${isConnected ? 'secondary' : 'primary'} glow-effect`}
                    onClick={() => setShowDbConnection(true)}
                  >
                    {isConnected ? 'Reconnect DB' : 'Connect DB'}
                  </button>
                </div>
                {isConnected && (
                  <div className="db-status" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="db-status-dot" style={{ 
                      width: '10px', 
                      height: '10px', 
                      backgroundColor: '#4CAF50', 
                      borderRadius: '50%', 
                      display: 'inline-block',
                      marginRight: '8px'
                    }}></span>
                    Connected: {databaseOptions.find(db => db.id === selectedDbType)?.logo} {dbConfig.database}
                  </div>
                )}
              </div>
              
              {/* Success message section */}
              {successMessage && (
                <div className="success-message" style={{ 
                  backgroundColor: 'rgba(76, 175, 80, 0.1)', 
                  color: '#4CAF50', 
                  padding: '10px', 
                  borderRadius: '5px', 
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  {successMessage}
                </div>
              )}
              
              {/* Error message section */}
              {error && (
                <div className="error-message" style={{ 
                  backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                  color: '#F44336', 
                  padding: '10px', 
                  borderRadius: '5px', 
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {error}
                </div>
              )}
              
              {/* Generation Results */}
              {generationResults && (
                <div className="results-card" style={{
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  borderLeft: '4px solid #1976D2',
                  padding: '15px',
                  borderRadius: '5px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>Generation Results</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong>Table:</strong> {generationResults.table_name}</div>
                    <div><strong>Records inserted:</strong> {generationResults.records_inserted}</div>
                    <div><strong>Execution time:</strong> {generationResults.message.split(' in ')[1].split(' seconds')[0]} seconds</div>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleGenerateData}>
                <div className="form-group">
                  <label>Enter your schema or JSON format:</label>
                  <textarea
                    rows="12"
                    style={{ minHeight: '300px' }}
                    value={schemaInput}
                    onChange={(e) => setSchemaInput(e.target.value)}
                    className="code-editor"
                  ></textarea>
                </div>

                {/* Target Database Dropdown */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label>Select Target Database:</label>
                  <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                    <select 
                      value={selectedDbType}
                      onChange={handleDbTypeChange}
                      style={{
                        width: '100%',
                        padding: '12px 15px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--background-light)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        appearance: 'none',
                        fontFamily: 'inherit',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px var(--shadow-color)'
                      }}
                    >
                      {databaseOptions.map(db => (
                        <option key={db.id} value={db.id}>
                          {db.logo} {db.name}
                        </option>
                      ))}
                    </select>
                    {/* Custom dropdown arrow */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      right: '15px',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none'
                    }}>
                      <svg width="12" height="6" viewBox="0 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L6 5L11 1" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Schema Helper Button */}
                {/* <div className="form-group" style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: '100%' }}
                    onClick={() => setSchemaInput(getExampleSchema(selectedDbType))}
                  >
                    Load Example Schema for {databaseOptions.find(db => db.id === selectedDbType)?.name}
                  </button>
                </div> */}

                <div className="form-group" style={{ textAlign: 'center', marginTop: '30px' }}>
                  <button 
                    type="submit"
                    className="btn primary"
                    style={{ 
                      padding: '0.75rem 2rem',
                      fontSize: '1.1rem',
                      animation: isGenerating ? 'glow 1.5s infinite alternate' : 'none'
                    }}
                    disabled={isGenerating || !isConnected}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Data'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-content">
          <div className="footer-logo">
            <DatabaseIcon />
            <span>SQLify</span>
          </div>
          <div className="footer-links">
            <Link to="/#features">Features</Link>
            <Link to="/#how-it-works">How It Works</Link>
            <Link to="/#demo">Try It</Link>
            <Link to="/#contact">Contact</Link>
          </div>
        </div>
        <div className="copyright">
          <p>© 2025 SQLify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default SyntheticDataPage;
