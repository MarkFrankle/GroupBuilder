from flask import Flask, jsonify
from flask_cors import CORS
# from group_builder.assignments import generate_assignments

app = Flask(__name__)
CORS(app)

@app.route('/test', methods=['GET'])
def test():
    return jsonify({'message': 'API is working!'})

@app.route('/assignments', methods=['GET'])
def get_assignments():
    """
    API endpoint to fetch table assignments.
    """
    try:
        # Call the optimization script
        # assignments = generate_assignments()  # Replace with your actual function
        assignments = {}
        return jsonify(assignments)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
