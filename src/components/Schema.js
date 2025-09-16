import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../Schema.css';
import EnhancedAnimation from './EnhancedAnimation';

function Schema() {
  const [englishQuery, setEnglishQuery] = useState('');
  const [generatedSchema, setGeneratedSchema] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sqlOutput, setSqlOutput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [activeTab, setActiveTab] = useState('schema');
  const [selectedTable, setSelectedTable] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    if (generatedSchema?.tables && generatedSchema.tables.length > 0) {
      setSelectedTable(generatedSchema.tables[0].name);
    }
  }, [generatedSchema]);

  useEffect(() => {
    if (selectedTable && generatedSchema && activeTab === 'json') {
      handleGenerateJson();
    }
  }, [selectedTable]);

  const handleEnglishQueryChange = (e) => {
    setEnglishQuery(e.target.value);
  };

  const handleConvertToSql = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        prompt: englishQuery,
        output_format: "json"
      };

      const response = await fetch("https://sqlify-skkz.onrender.com/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.status === "error") {
        setError(`Error: ${data.message}`);
      } else {
        setGeneratedSchema(data.schema);
        setSqlOutput('');
        setJsonOutput('');
        setActiveTab('schema');
      }
    } catch (err) {
      setError('Failed to generate schema. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSql = async () => {
    if (!generatedSchema) return;
    
    setIsExporting(true);
    try {
      const response = await fetch("https://sqlify-skkz.onrender.com/generate-schema-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: generatedSchema })
      });
      
      const data = await response.json();
      
      if (data.status === "error") {
        setError(`Error: ${data.message}`);
      } else {
        setSqlOutput(data.sql);
        setActiveTab('sql');
      }
    } catch (err) {
      setError('Failed to generate SQL. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateJson = async () => {
    if (!generatedSchema || !selectedTable) return;
    
    setIsExporting(true);
    try {
      const response = await fetch("https://sqlify-skkz.onrender.com/generate-schema-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          schema: generatedSchema,
          tableName: selectedTable
        })
      });
      
      const data = await response.json();
      
      if (data.status === "error") {
        setError(`Error: ${data.message}`);
      } else {
        setJsonOutput(JSON.stringify(data.json, null, 2));
        if (activeTab !== 'json') {
          setActiveTab('json');
        }
      }
    } catch (err) {
      setError('Failed to generate JSON. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTableChange = (e) => {
    setSelectedTable(e.target.value);
  };

  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied to clipboard!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      setCopyFeedback('Failed to copy. Try again.');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  const renderSchemaTables = () => {

    if (!generatedSchema?.tables) return null;

    return generatedSchema.tables.map((table, index) => (
      <div key={index} className="schema-table-container">
        <h3 className="schema-table-name">{table.name}</h3>
        <table className="schema-table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Data Type</th>
              <th>Constraints</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column, colIndex) => (
              <tr key={colIndex}>
                <td>
                  {column.name}
                  {column.primary_key && <span className="schema-pk-marker"> PK</span>}
                </td>
                <td>{column.data_type}</td>
                <td>
                  {column.foreign_key && (
                    <span className="schema-fk-relation">
                      FK → {column.foreign_key.table}.{column.foreign_key.column}
                    </span>
                  )}
                  {column.unique && !column.primary_key && <span>Unique</span>}
                  {column.default !== null && (
                    <span>Default: {column.default}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  };

  const renderTableSelector = () => {
    if (!generatedSchema?.tables || generatedSchema.tables.length <= 1) return null;

    return (
      <div className="schema-form-group schema-table-selector">
        <label>Select Table for JSON Export:</label>
        <select
          className="schema-input-field"
          value={selectedTable}
          onChange={handleTableChange}
        >
          {generatedSchema.tables.map((table, index) => (
            <option key={index} value={table.name}>
              {table.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'schema':
        return (
          <div className="schema-content">
            {renderSchemaTables()}
          </div>
        );
      case 'sql':
        return (
          <div className="schema-export-output">
            <pre className="schema-code-block">{sqlOutput}</pre>
            <div className="schema-copy-container">
              <button 
                className="schema-btn schema-btn-secondary schema-copy-btn"
                onClick={() => handleCopyToClipboard(sqlOutput)}
              >
                Copy to Clipboard
              </button>
              {copyFeedback && <span className="schema-copy-feedback">{copyFeedback}</span>}
            </div>
          </div>
        );
      case 'json':
        return (
          <div className="schema-export-output">
            {renderTableSelector()}
            <pre className="schema-code-block">{jsonOutput}</pre>
            <div className="schema-copy-container">
              <button 
                className="schema-btn schema-btn-secondary schema-copy-btn"
                onClick={() => handleCopyToClipboard(jsonOutput)}
              >
                Copy to Clipboard
              </button>
              {copyFeedback && <span className="schema-copy-feedback">{copyFeedback}</span>}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTabButtons = () => {
    if (!generatedSchema) return null;

    return (
      <div className="schema-tab-buttons">
        <button 
          className={`schema-tab-btn ${activeTab === 'schema' ? 'schema-tab-active' : ''}`}
          onClick={() => setActiveTab('schema')}
        >
          Schema
        </button>
        <button 
          className={`schema-tab-btn ${activeTab === 'sql' ? 'schema-tab-active' : ''}`}
          onClick={() => {
            if (sqlOutput) {
              setActiveTab('sql');
            } else {
              handleGenerateSql();
            }
          }}
          disabled={isExporting && activeTab === 'sql'}
        >
          SQL
        </button>
        <button 
          className={`schema-tab-btn ${activeTab === 'json' ? 'schema-tab-active' : ''}`}
          onClick={() => {
            if (jsonOutput) {
              setActiveTab('json');
            } else {
              handleGenerateJson();
            }
          }}
          disabled={isExporting && activeTab === 'json'}
        >
          JSON
        </button>
      </div>
    );
  };

  const renderExportButtons = () => {
    if (!generatedSchema) return null;

    return (
      <div className="schema-export-buttons">
        <button 
          className="schema-btn schema-btn-secondary schema-glow-effect"
          onClick={handleGenerateSql}
          disabled={isExporting}
        >
          {isExporting && activeTab === 'sql' ? 'Generating SQL...' : 'Generate SQL'}
        </button>
        <button 
          className="schema-btn schema-btn-secondary schema-glow-effect"
          onClick={handleGenerateJson}
          disabled={isExporting}
        >
          {isExporting && activeTab === 'json' ? 'Generating JSON...' : 'Generate JSON'}
        </button>
      </div>
    );
  };

  return (
    <div className="schema-app">
      <EnhancedAnimation />
      
      <main className="schema-main-content">
        <div className="schema-container">
          <div className="schema-page-header">
            <h1 className="schema-glow-text">Database Schema Generator</h1>
            <p className="schema-subtitle">Convert your requirements into a complete database schema</p>
          </div>
          
          <div className="schema-editor-layout">
            <div className="schema-input-form-container">
              <div className="schema-card">
                <div className="schema-card-header">
                  <h2>Schema Requirements</h2>
                </div>
                <div className="schema-card-body">
                  <div className="schema-form-group">
                    <label>Describe your database needs:</label>
                    <textarea 
                      value={englishQuery}
                      onChange={handleEnglishQueryChange}
                      rows="6"
                      placeholder="Example: Create a database schema for a hospital with doctors, patients, appointments, and prescriptions"
                      className="schema-input-field schema-textarea"
                    ></textarea>
                  </div>
                  
                  <button 
                    className="schema-btn schema-btn-primary schema-glow-effect schema-full-width"
                    onClick={handleConvertToSql}
                    disabled={isLoading || !englishQuery.trim()}
                  >
                    {isLoading ? 'Generating Schema...' : 'Generate Schema'}
                  </button>
                </div>
              </div>
            </div>

            <div className="schema-result-container">
              <div className="schema-card schema-result">
                <div className="schema-card-header">
                  <h2>Generated Database Schema</h2>
                  {renderExportButtons()}
                </div>
                <div className="schema-card-body">
                  {error && (
                    <div className="schema-error-message">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  {isLoading && !generatedSchema && (
                    <div className="schema-loading-indicator">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="schema-animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                      <span>Generating schema...</span>
                    </div>
                  )}

                  {generatedSchema && renderTabButtons()}
                  {generatedSchema && renderContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Schema;
