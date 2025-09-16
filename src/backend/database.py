from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect

db = SQLAlchemy()

def create_dynamic_model(table_name, schema):
    """Create SQLAlchemy model class dynamically"""
    type_map = {
        'string': db.String(255),
        'integer': db.Integer,
        'email': db.String(100),
        'date': db.DateTime,
        'boolean': db.Boolean,
        'float': db.Float
    }
    
    attributes = {
        '__tablename__': table_name,
        'id': db.Column(db.Integer, primary_key=True)
    }
    
    for field in schema:
        col_name = field['name']
        col_type = type_map.get(field['type'].lower(), db.String(255))
        attributes[col_name] = db.Column(col_type)
    
    return type(f'Table_{table_name}', (db.Model,), attributes)

def table_exists(table_name):
    """Check if table exists in MySQL"""
    inspector = inspect(db.engine)
    return inspector.has_table(table_name)