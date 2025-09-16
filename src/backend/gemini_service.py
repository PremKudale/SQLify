import google.generativeai as genai
import json
import logging

logger = logging.getLogger(__name__)

# Correct configuration
genai.configure(api_key='AIzaSyAVWkx8QNPOeorojp2IHhj4A72j8_pJmNU')

def generate_synthetic_data(schema, num_rows):
    try:
        # Use the recommended stable model for text generation
        model = genai.GenerativeModel('models/gemini-1.5-pro-002')
        
        prompt = f"""Generate {num_rows} realistic data entries as a JSON array of objects.
Schema: {json.dumps(schema, indent=2)}

Requirements:
- Return only a JSON array
- No markdown formatting
- Validate data types
- Example format:
  [{{"id": 1, "name": "John", "email": "john@test.com"}}]"""
        
        response = model.generate_content(prompt)
        return json.loads(response.text)
    
    except Exception as e:
        logger.error(f"Generation error: {str(e)}")
        raise Exception(f"Data generation failed: {str(e)}")
