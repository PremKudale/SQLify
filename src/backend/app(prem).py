from flask import Flask, request, jsonify
from database import db, create_dynamic_model, table_exists
from gemini_service import generate_synthetic_data
from dotenv import load_dotenv
import logging
import uuid
import os

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Create all tables (for initial setup)
with app.app_context():
    db.create_all()

@app.route('/generate', methods=['POST'])
def generate_and_store():
    try:
        data = request.get_json()
        if not data or 'schema' not in data:
            return jsonify({'error': 'Schema is required'}), 400
        
        schema = data['schema']
        num_rows = data.get('num_rows', 10)
        table_name = data.get('table_name', f'table_{uuid.uuid4().hex[:6]}')

        # Create dynamic model
        Model = create_dynamic_model(table_name, schema)
        
        # Create table if not exists
        if not table_exists(table_name):
            with app.app_context():
                Model.__table__.create(db.engine)
        
        # Generate data
        records = generate_synthetic_data(schema, num_rows)
        
        # Insert data
        with app.app_context():
            for record in records:
                db.session.add(Model(**record))
            db.session.commit()
        
        return jsonify({
            'message': 'Data generated and stored successfully',
            'table_name': table_name,
            'records_inserted': len(records)
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)