import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../SQLEditorPage.css';
import EnhancedAnimation from './EnhancedAnimation';
import Editor from '@monaco-editor/react';

const backendUrl = "https://sqlify-skkz.onrender.com";

function SQLEditorPage() {
  const [englishQuery, setEnglishQuery] = useState('');
  const [schemaInfo, setSchemaInfo] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [queryHistory, setQueryHistory] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState('');
  const [showDbConnection, setShowDbConnection] = useState(false);
  const [selectedDbType, setSelectedDbType] = useState('postgres');
  const [useDbSchema, setUseDbSchema] = useState(false);

  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "5432",
    user: "postgres",
    password: "",
    database: "postgres"
  });
  const [isConnected, setIsConnected] = useState(false);
  const [generatedQueryResult, setGeneratedQueryResult] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const databaseOptions = [
    { id: 'mysql', name: 'MySQL', logo: '🐬', defaultPort: '3306' },
    { id: 'postgres', name: 'PostgreSQL', logo: '🐘', defaultPort: '5432' },
    { id: 'oracle', name: 'Oracle', logo: '🔴', defaultPort: '1521' },
    { id: 'sqlserver', name: 'SQL Server', logo: '🔷', defaultPort: '1433' },
    { id: 'mongodb', name: 'MongoDB', logo: '🍃', defaultPort: '27017' },
    { id: 'sqlite', name: 'SQLite', logo: '🔋', defaultPort: '' }
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Format cell values based on type
  const formatCellValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="null-value">NULL</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span className={`boolean-cell ${value ? 'true' : 'false'}`}>
          {value.toString()}
        </span>
      );
    }

    if (typeof value === 'number') {
      return <span className="numeric-cell">{value}</span>;
    }

    if (typeof value === 'object') {
      try {
        return (
          <pre className="json-cell">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      } catch (e) {
        return '[Object]';
      }
    }

    return value;
  };

  // Pagination calculations
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = queryResult?.rows?.slice(indexOfFirstRow, indexOfLastRow) || [];
  const totalPages = Math.ceil((queryResult?.rows?.length || 0) / rowsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleDbTypeChange = (e) => {
    const dbType = e.target.value;
    setSelectedDbType(dbType);

    const dbOption = databaseOptions.find(db => db.id === dbType);
    if (dbOption) {
      setDbConfig(prev => ({
        ...prev,
        port: dbOption.defaultPort || '',
        user: dbType === 'postgres' ? 'postgres' : 'root'
      }));
    }
  };

  const handleEnglishQueryChange = (e) => {
    setEnglishQuery(e.target.value);
  };

  const handleSchemaInfoChange = (e) => {
    setSchemaInfo(e.target.value);
  };

  const handleSqlQueryChange = (value) => {
    setSqlQuery(value);
    setSelectedQuery(''); // Reset selected query when editor content changes
  };

  const handleDbConfigChange = (e) => {
    const { name, value } = e.target;
    setDbConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConnectToDb = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
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
        throw new Error(data.error);
      } else {
        setSuccessMessage(`Successfully connected to ${dbConfig.database || selectedDbType} database`);
        setIsConnected(true);
        setShowDbConnection(false);
      }
    } catch (err) {
      setError(err.message || "Failed to connect to database. Please check your connection details.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToEditor = () => {
    if (generatedQueryResult?.query) {
      setSqlQuery(generatedQueryResult.query);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleConvertToSql = async () => {
    if (!englishQuery.trim()) {
      setError("Please enter an English query");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedQueryResult(null);

    try {
      let finalSchema = null;

      // Auto-fetch schema only if checkbox is checked and connected
      if (useDbSchema && isConnected) {
        try {
          const schemaResponse = await fetch("https://sqlify-backend-2.onrender.com/get-full-schema");
          if (!schemaResponse.ok) throw new Error("Failed to fetch database schema");
          const schemaData = await schemaResponse.json();
          finalSchema = JSON.stringify(schemaData);
        } catch (err) {
          console.error("Schema fetch error:", err);
          setError("Failed to fetch database schema. Please ensure you're connected.");
          return; // Abort if auto-fetch fails
        }
      } else {
        if (schemaInfo.trim() === '') {
          finalSchema = "none";
        } else {
          finalSchema = schemaInfo; // Use manual schema only when checkbox is unchecked
        }
      }

      const payload = {
        prompt: englishQuery,
        database_type: selectedDbType,
        ...(finalSchema ? { schema: finalSchema } : {})
      };


      const response = await fetch("https://sqlify-skkz.onrender.com/generate-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      } else {
        setGeneratedQueryResult({
          query: data.query,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to convert query. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    if (!isConnected) {
      setError("Please connect to a database first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    setCurrentPage(1); // Reset to first page on new query

    try {
      const queryToExecute = selectedQuery || sqlQuery;
      const response = await fetch("https://sqlify-backend-2.onrender.com/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sqlQuery: queryToExecute,
          database: selectedDbType
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSuccessMessage(data.message || "Query executed successfully");

      // Add to history
      const newHistoryItem = {
        query: queryToExecute,
        timestamp: new Date().toLocaleTimeString(),
        type: data.query_type || 'UNKNOWN',
        database: selectedDbType
      };
      setQueryHistory(prev => [newHistoryItem, ...prev].slice(0, 10));

      // Handle results
      if (data.result && data.result.length > 0) {
        const columns = Object.keys(data.result[0]);
        setQueryResult({
          columns,
          rows: data.result,
          queryType: data.query_type,
          rowCount: data.row_count || data.result.length
        });
      } else {
        // For non-SELECT queries that don't return results
        setQueryResult(prev => prev ? { ...prev, queryType: data.query_type } : null);
      }
    } catch (err) {
      setError(err.message || "Failed to execute query. Please check your connection and query syntax.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySQL = () => {
    if (!sqlQuery.trim()) return;
    navigator.clipboard.writeText(sqlQuery);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const loadQueryFromHistory = (query) => {
    setSqlQuery(query);
    setSelectedQuery('');
  };

  const executeSelectedStatement = () => {
    if (selectedQuery) {
      handleExecuteQuery();
    }
  };

  const DatabaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  );

  const ResultComponent = () => {
    if (!generatedQueryResult) return null;

    return (
      <div className="card mt-4 generated-query-result">
        <div className="card-header">
          <h2>Generated SQL Query</h2>
          <button
            className="btn primary copy-btn"
            onClick={handleCopyToEditor}
            disabled={!generatedQueryResult.query}
          >
            {isCopied ? 'Copied!' : 'Copy to Editor'}
          </button>
        </div>
        <div className="card-body">
          <div className="code-display">
            <pre>{generatedQueryResult.query}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app2
    ">
      <EnhancedAnimation />

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
                <label>Database Type:</label>
                <select
                  value={selectedDbType}
                  onChange={handleDbTypeChange}
                  className="input-field"
                >
                  {databaseOptions.map(db => (
                    <option key={db.id} value={db.id}>
                      {db.logo} {db.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Host:</label>
                <input
                  type="text"
                  name="host"
                  value={dbConfig.host}
                  onChange={handleDbConfigChange}
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>Port:</label>
                <input
                  type="text"
                  name="port"
                  value={dbConfig.port}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  placeholder="Default port"
                />
              </div>
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  name="user"
                  value={dbConfig.user}
                  onChange={handleDbConfigChange}
                  className="input-field"
                />
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
                <label>Database Name:</label>
                <input
                  type="text"
                  name="database"
                  value={dbConfig.database}
                  onChange={handleDbConfigChange}
                  className="input-field"
                  placeholder="Optional"
                />
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

      <header className="site-header">
        <div className="container">
          <div className="logo">
            <Link to="/">
              <DatabaseIcon />
              <span>SQLify</span>
            </Link>
          </div>
          <nav className="main-nav">
            <Link to="/homepage">Home</Link>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#demo">Try It</a>
          </nav>
          <div className="header-actions">
            <button className="btn secondary">Dashboard</button>
          </div>
        </div>
      </header>

      <main className="main-content1">
        <div className="container">
          <div className="page-header">
            <h1 className="glow-text">Natural Language to SQL</h1>
            <p className="subtitle">Convert your English queries to SQL code with our AI-powered tool</p>
          </div>

          <div className="editor-layout">
            <div className="english-input-section">
              <div className="card">
                <div className="card-header">
                  <h2>English Query</h2>
                </div>
                <div className="card-body1">
                  <div className="form-group">
                    <label>Enter your query in English:</label>
                    <textarea
                      value={englishQuery}
                      onChange={handleEnglishQueryChange}
                      rows="4"
                      placeholder="Example: Show me all users who registered last month with gmail accounts"
                      className="input-field textarea"
                    ></textarea>
                  </div>

                  <div className="form-group">
                    <label>
                      <div className="schema-options">
                        <div className="schema-checkbox">
                          <input
                            type="checkbox"
                            checked={useDbSchema}
                            onChange={(e) => setUseDbSchema(e.target.checked)}
                            disabled={!isConnected}
                            id="useDbSchema"
                          />
                          <label htmlFor="useDbSchema" className="checkbox-label">
                            Use connected database schema
                            {!isConnected && (
                              <span className="connection-required"> (connect to database first)</span>
                            )}
                          </label>
                        </div>
                        <span className="tooltip-trigger">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          <span className="tooltip-content">
                            When enabled, automatically uses schema from your connected database
                          </span>
                        </span>
                      </div>
                    </label>
                    <textarea
                      value={schemaInfo}
                      onChange={handleSchemaInfoChange}
                      rows="4"
                      placeholder="Example: users(id INT, name VARCHAR, email VARCHAR, registration_date DATE)"
                      className="input-field textarea schema-textarea"
                      disabled={useDbSchema}
                    ></textarea>
                  </div>

                  <div className="form-group">
                    <label>Select Database Type:</label>
                    <select
                      value={selectedDbType}
                      onChange={handleDbTypeChange}
                      className="input-field"
                    >
                      {databaseOptions.map(db => (
                        <option key={db.id} value={db.id}>
                          {db.logo} {db.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn primary glow-effect full-width"
                    onClick={handleConvertToSql}
                    disabled={isLoading || !englishQuery.trim()}
                  >
                    {isLoading ? 'Generating Query...' : 'Generate SQL Query'}
                  </button>
                </div>
              </div>

              <ResultComponent />

              <div className="card mt-4">
                <div className="card-header">
                  <h2>Query History</h2>
                </div>
                <div className="card-body">
                  {queryHistory.length === 0 ? (
                    <p className="text-center">No queries executed yet</p>
                  ) : (
                    <ul className="query-history-list">
                      {queryHistory.map((item, index) => (
                        <li
                          key={index}
                          className="query-history-item"
                          onClick={() => loadQueryFromHistory(item.query)}
                        >
                          <div className="query-history-info">
                            <span className={`query-type ${item.type.toLowerCase()}`}>
                              {item.type}
                            </span>
                            <span className="query-db-type">
                              {databaseOptions.find(db => db.id === item.database)?.logo || '💾'}
                            </span>
                            <span className="query-time">{item.timestamp}</span>
                          </div>
                          <div className="query-text">
                            {item.query.length > 50 ? item.query.substring(0, 50) + '...' : item.query}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="sql-editor-section">
              <div className="card-sql">
                <div className="card-header">
                  <h2>SQL Editor</h2>
                  <div className="card-header-actions">
                    <div className="db-connection-controls">
                      <button
                        className={`btn ${isConnected ? 'secondary' : 'primary'} glow-effect`}
                        onClick={() => setShowDbConnection(true)}
                      >
                        {isConnected ? 'Reconnect DB' : 'Connect DB'}
                      </button>
                    </div>
                    <div className="connected-db">
                      {isConnected && (
                        <div className="db-status">
                          <span className="db-status-dot"></span>
                          Connected: {databaseOptions.find(db => db.id === selectedDbType)?.logo} {dbConfig.database || selectedDbType}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label>SQL Query: (You can edit this)</label>
                    <div className="code-editor">
                      <div className="editor-header">
                        <span>SQL Editor</span>
                        <div className="editor-actions">
                          <button
                            className="btn small secondary"
                            onClick={handleCopySQL}
                            disabled={!sqlQuery.trim()}
                          >
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            className="btn small primary glow-effect"
                            onClick={handleExecuteQuery}
                            disabled={isLoading || !sqlQuery.trim() || !isConnected}
                          >
                            {isLoading ? 'Executing...' : 'Execute Query'}
                          </button>
                        </div>
                      </div>
                      <div className="editor-content" style={{ height: "300px" }}>
                        <Editor
                          height="100%"
                          defaultLanguage="sql"
                          value={sqlQuery}
                          onChange={handleSqlQueryChange}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 14,
                            formatOnType: true,
                            wordWrap: 'on',
                            automaticLayout: true
                          }}
                          theme="vs-dark"
                        />
                      </div>
                    </div>
                  </div>

                  {sqlQuery.includes(';') && sqlQuery.split(';').filter(q => q.trim()).length > 1 && (
                    <div className="statement-selection">
                      <p>Multiple SQL statements detected. You can select a specific statement to execute:</p>
                      <div className="statement-list">
                        {sqlQuery.split(';').filter(q => q.trim()).map((statement, index) => (
                          <div
                            key={index}
                            className={`statement-item ${selectedQuery === statement.trim() ? 'selected' : ''}`}
                            onClick={() => setSelectedQuery(statement.trim())}
                          >
                            <span className="statement-number">{index + 1}</span>
                            <span className="statement-preview">
                              {statement.trim().length > 30 ? statement.trim().substring(0, 30) + '...' : statement.trim()}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="statement-actions">
                        <button
                          className="btn small secondary"
                          onClick={() => setSelectedQuery('')}
                          disabled={!selectedQuery}
                        >
                          Clear Selection
                        </button>
                        <button
                          className="btn small primary"
                          onClick={executeSelectedStatement}
                          disabled={!selectedQuery || isLoading}
                        >
                          Execute Selected Statement
                        </button>
                      </div>
                    </div>
                  )}

                  {successMessage && (
                    <div className="success-message">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      {successMessage}
                    </div>
                  )}

                  {error && (
                    <div className="error-message">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      {error}
                    </div>
                  )}

                  {queryResult && (
                    <div className="query-results-container">
                      <div className="results-header">
                        <h3>Query Results</h3>
                        <div className="results-meta">
                          <span>{queryResult.rowCount || queryResult.rows.length} row{queryResult.rowCount !== 1 ? 's' : ''}</span>
                          <span>{queryResult.columns.length} column{queryResult.columns.length !== 1 ? 's' : ''}</span>
                          {queryResult.queryType && (
                            <span className={`query-type ${queryResult.queryType.toLowerCase()}`}>
                              {queryResult.queryType}
                            </span>
                          )}
                        </div>
                      </div>

                      {queryResult.rows && queryResult.rows.length > 0 ? (
                        <>
                          <div className="results-table-wrapper">
                            <table className="results-table">
                              <thead>
                                <tr>
                                  {queryResult.columns.map((column, index) => (
                                    <th key={index}>
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {currentRows.map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {queryResult.columns.map((column, colIndex) => (
                                      <td key={colIndex}>
                                        {formatCellValue(row[column])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {totalPages > 1 && (
                            <div className="results-pagination">
                              <div className="pagination-info">
                                Showing {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, queryResult.rows.length)} of {queryResult.rows.length} rows
                              </div>
                              <div className="pagination-controls">
                                <button
                                  className="btn secondary small"
                                  onClick={() => paginate(currentPage - 1)}
                                  disabled={currentPage === 1}
                                >
                                  Previous
                                </button>
                                <span className="page-numbers">
                                  Page {currentPage} of {totalPages}
                                </span>
                                <button
                                  className="btn secondary small"
                                  onClick={() => paginate(currentPage + 1)}
                                  disabled={currentPage === totalPages}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="results-empty">
                          <p>No rows returned</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <Link to="/">
                <DatabaseIcon />
                <span>SQLify</span>
              </Link>
            </div>
            <div className="footer-links">
              <Link to="/homepage">Home</Link>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <div className="copyright">
            <p>© 2025 SQLify. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SQLEditorPage;
